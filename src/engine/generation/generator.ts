import type { Articulation, Chart, ChartNote, DrillConfig, NoteFrets, StrumDirection } from '../domain';
import { TICKS_PER_QUARTER } from '../domain/music';
import { parseDrillConfig, getDrillGeometry } from '../domain/configuration';
import { immutableCopy } from '../domain/immutable';
import { countFrets, requireCondition } from '../domain/validation';
import { createSeededRandom, hashSeed } from './random';

export const INITIAL_GENERATOR = Object.freeze({ id: 'initial-generator', version: '1.0.0' });
export const ASCENDING_DESCENDING_PATTERN = Object.freeze({ id: 'ascending-descending', version: '1.0.0' });
export const REPEATED_STRUM_PATTERN = Object.freeze({ id: 'repeated-strum', version: '1.0.0' });
export const ARTICULATION_TRANSITIONS_PATTERN = Object.freeze({ id: 'articulation-transitions', version: '1.0.0' });

interface PatternStep {
  readonly frets: NoteFrets;
  readonly articulation?: Articulation;
}

function createPattern(config: DrillConfig): readonly PatternStep[] {
  requireCondition(config.pattern.version === '1.0.0', 'config.pattern.version', 'Pattern version is not implemented.', 'unsupported');
  requireCondition(config.level === 'beginner', 'config.level', 'Initial generators expose the beginner level only.', 'unsupported');
  const frets = [1, 2, 4, 8, 16].filter((fret) => (fret & config.allowedFrets) !== 0) as NoteFrets[];

  if (config.pattern.id === ASCENDING_DESCENDING_PATTERN.id) {
    requireCondition(config.chordSize === 1 && frets.length >= 2, 'config.allowedFrets', 'Ascending/descending needs at least two single frets.');
    requireCondition(config.patternLength === 2 * frets.length, 'config.patternLength', 'Pattern length must include the complete ascent and descent.');
    requireCondition(['sequences', 'hopo', 'tapping', 'sustains'].includes(config.technique), 'config.technique', 'Technique does not match this pattern.');
    requireCondition(config.articulation !== 'mixed', 'config.articulation', 'Mixed articulation is not implemented by this generator.', 'unsupported');
    requireCondition(config.technique !== 'hopo' || config.articulation === 'hopo', 'config.articulation', 'HOPO technique requires HOPO notes.');
    requireCondition(config.technique !== 'tapping' || config.articulation === 'tap', 'config.articulation', 'Tapping technique requires tap notes.');
    requireCondition(config.technique !== 'sustains' || config.sustainTicks > 0, 'config.sustainTicks', 'Sustain technique requires tails.');
    return [...frets, ...[...frets].reverse()].map((fret) => ({ frets: fret }));
  }

  if (config.pattern.id === ARTICULATION_TRANSITIONS_PATTERN.id) {
    requireCondition(config.technique === 'mixed' && config.articulation === 'mixed',
      'config.technique', 'Articulation transitions require a mixed exercise.');
    requireCondition(config.chordSize === 3 && frets.length >= 3, 'config.chordSize', 'Mixed transitions require three available frets.');
    requireCondition(config.patternLength === 6, 'config.patternLength', 'Mixed transitions contain six steps.');
    const first = frets[0];
    const second = frets[1];
    const third = frets[2];
    requireCondition(first !== undefined && second !== undefined && third !== undefined,
      'config.allowedFrets', 'Mixed transitions require three available frets.');
    return [
      { frets: first, articulation: 'strum' },
      { frets: second, articulation: 'hopo' },
      { frets: (second | third) as NoteFrets, articulation: 'strum' },
      { frets: third, articulation: 'tap' },
      { frets: (first | second | third) as NoteFrets, articulation: 'strum' },
      { frets: first, articulation: 'hopo' },
    ];
  }

  requireCondition(config.pattern.id === REPEATED_STRUM_PATTERN.id, 'config.pattern.id', 'Pattern is not implemented.', 'unsupported');
  requireCondition(config.articulation === 'strum', 'config.articulation', 'Repeated strum requires strum notes.');
  requireCondition(['single-strum', 'alternate-strum', 'chords', 'sustains'].includes(config.technique), 'config.technique', 'Technique does not match this pattern.');
  requireCondition(!['single-strum', 'alternate-strum'].includes(config.technique) || config.chordSize === 1,
    'config.chordSize', 'Single/alternate strum patterns use single frets.');
  requireCondition(config.technique !== 'chords' || config.chordSize > 1, 'config.chordSize', 'Chord technique requires two or three frets.');
  requireCondition(config.technique !== 'sustains' || config.sustainTicks > 0, 'config.sustainTicks', 'Sustain technique requires tails.');
  requireCondition(config.technique !== 'alternate-strum' || config.strumDirectionGoal.kind === 'alternate', 'config.strumDirectionGoal', 'Alternate strum requires alternating directions.');
  const masks: NoteFrets[] = [];
  for (let mask = 1; mask <= 31; mask += 1) {
    if ((mask & config.allowedFrets) === mask && countFrets(mask) === config.chordSize) masks.push(mask as NoteFrets);
  }
  const mask = masks[createSeededRandom(config.seed).nextIndex(masks.length)];
  requireCondition(mask !== undefined, 'config.allowedFrets', 'No playable fret mask.');
  return Array.from({ length: config.patternLength }, () => ({ frets: mask }));
}

export function generateDrill(value: unknown): Chart {
  const config = parseDrillConfig(value);
  const { stepTicks, lengthTicks, noteCount } = getDrillGeometry(config);
  const pattern = createPattern(config);
  // A identidade inclui a configuração canônica. O hash não é usado como prova de igualdade.
  const identity = `${INITIAL_GENERATOR.id}@${INITIAL_GENERATOR.version}:${hashSeed(JSON.stringify(config)).toString(16)}`;
  let nextDirection: StrumDirection = config.strumDirectionGoal.kind === 'alternate'
    ? config.strumDirectionGoal.firstDirection : 'down';
  let previousArticulation: Articulation | null = null;
  const notes: ChartNote[] = [];
  for (let index = 0; index < noteCount; index += 1) {
    const patternIndex = index % config.patternLength;
    const repetition = Math.floor(index / config.patternLength);
    const step = pattern[patternIndex];
    requireCondition(step !== undefined, 'pattern', 'Pattern index is unavailable.');
    const articulation = step.articulation ?? config.articulation;
    requireCondition(articulation !== 'mixed', 'pattern.articulation', 'A mixed pattern must materialize every articulation.');
    let expectedStrumDirection: StrumDirection | null = null;
    if (articulation === 'strum' && config.strumDirectionGoal.kind === 'fixed') {
      expectedStrumDirection = config.strumDirectionGoal.direction;
    } else if (articulation === 'strum' && config.strumDirectionGoal.kind === 'alternate') {
      if (patternIndex === 0 || previousArticulation !== 'strum'
        || stepTicks - config.sustainTicks >= config.strumDirectionGoal.resetAfterRestTicks) {
        nextDirection = config.strumDirectionGoal.firstDirection;
      }
      expectedStrumDirection = nextDirection;
      nextDirection = nextDirection === 'down' ? 'up' : 'down';
    }
    notes.push({
      id: `${identity}:note:${index}`,
      tick: index * stepTicks,
      frets: step.frets,
      durationTicks: config.sustainTicks,
      articulation,
      origin: { segmentId: `segment:${repetition}`, patternId: config.pattern.id, technique: config.technique, repetition },
      expectedStrumDirection,
    });
    previousArticulation = articulation;
  }
  return immutableCopy({
    id: identity, ticksPerQuarter: TICKS_PER_QUARTER, bpm: config.bpm, lengthTicks,
    generator: INITIAL_GENERATOR, seed: config.seed, notes,
  });
}

export const INITIAL_DRILL_CONFIG: DrillConfig = parseDrillConfig({
  schemaVersion: 1,
  technique: 'sequences', level: 'beginner', pattern: ASCENDING_DESCENDING_PATTERN,
  bpm: 120, subdivision: 2, allowedFrets: 31, patternLength: 10,
  length: { kind: 'repetitions', count: 4 }, articulation: 'strum', automaticStrum: true, chordSize: 1,
  sustainTicks: 0, strumDirectionGoal: { kind: 'none' },
  goals: { minimumAccuracy: 0.9, maximumErrors: 4, consistentAttempts: 3,
    requireArticulation: true, requireStrumDirection: false, requireFullSustains: false },
  seed: 'fretsense-start', ruleProfile: { id: 'fretsense-v1', version: '1.0.0' },
});

/** Cenário-base da etapa 08; presets e mutações procedurais pertencem ao catálogo da etapa 09. */
export const ARTICULATION_TRANSITIONS_DRILL_CONFIG: DrillConfig = parseDrillConfig({
  schemaVersion: 1,
  technique: 'mixed', level: 'beginner', pattern: ARTICULATION_TRANSITIONS_PATTERN,
  bpm: 100, subdivision: 2, allowedFrets: 31, patternLength: 6,
  length: { kind: 'repetitions', count: 2 }, articulation: 'mixed', automaticStrum: false, chordSize: 3,
  sustainTicks: 0, strumDirectionGoal: { kind: 'alternate', firstDirection: 'down', resetAfterRestTicks: 480 },
  goals: { minimumAccuracy: 0.9, maximumErrors: 3, consistentAttempts: 3,
    requireArticulation: true, requireStrumDirection: true, requireFullSustains: false },
  seed: 'fretsense-articulation-transitions', ruleProfile: { id: 'fretsense-v1', version: '1.0.0' },
});
