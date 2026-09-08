import type {
  Articulation, Chart, ChartNote, DrillConfig, DrillLevel, NoteFrets, StrumDirection, Technique,
} from '../domain';
import { TICKS_PER_QUARTER } from '../domain/music';
import { ENGINE_LIMITS as limits } from '../domain/limits';
import { immutableCopy } from '../domain/immutable';
import { countFrets, readInteger, requireCondition } from '../domain/validation';
import { createSeededRandom, hashSeed } from './random';

export const CATALOG_GENERATOR = Object.freeze({ id: 'procedural-catalog', version: '1.0.0' });

export const CATALOG_PATTERN_IDS = [
  'single-strum-beginner', 'single-strum-intermediate', 'single-strum-advanced',
  'alternate-strum-beginner', 'alternate-strum-intermediate', 'alternate-strum-advanced',
  'hopo-beginner', 'hopo-intermediate', 'hopo-advanced',
  'tapping-beginner', 'tapping-intermediate', 'tapping-advanced',
  'sequences-beginner', 'sequences-intermediate', 'sequences-advanced',
  'chords-beginner', 'chords-intermediate', 'chords-advanced',
  'sustains-beginner', 'sustains-intermediate', 'sustains-advanced',
  'mixed-beginner', 'mixed-intermediate', 'mixed-advanced',
] as const;

export type CatalogPatternId = typeof CATALOG_PATTERN_IDS[number];

interface CatalogPatternDefinition {
  readonly technique: Technique;
  readonly level: DrillLevel;
}

const PATTERN_DEFINITIONS = Object.freeze(Object.fromEntries(CATALOG_PATTERN_IDS.map((id) => {
  const level = id.endsWith('-beginner') ? 'beginner' : id.endsWith('-intermediate') ? 'intermediate' : 'advanced';
  const technique = id.slice(0, -(level.length + 1)) as Technique;
  return [id, { technique, level } satisfies CatalogPatternDefinition];
})) as Readonly<Record<CatalogPatternId, CatalogPatternDefinition>>);

interface PatternStep {
  readonly unit: number;
  readonly frets: NoteFrets;
  readonly articulation: Articulation;
  readonly segmentId: string;
  readonly sustain?: boolean;
}

interface PatternTemplate {
  readonly lengthUnits: number;
  readonly steps: readonly PatternStep[];
}

interface SeededRandom {
  nextIndex(size: number): number;
}

export function isCatalogPattern(id: string, version: string): id is CatalogPatternId {
  return version === '1.0.0' && (CATALOG_PATTERN_IDS as readonly string[]).includes(id);
}

function singleFrets(config: DrillConfig): NoteFrets[] {
  return [1, 2, 4, 8, 16].filter((fret) => (fret & config.allowedFrets) !== 0) as NoteFrets[];
}

function rotated<T>(items: readonly T[], random: SeededRandom): T[] {
  requireCondition(items.length > 0, 'config.allowedFrets', 'Pattern has no playable frets.');
  const offset = random.nextIndex(items.length);
  return [...items.slice(offset), ...items.slice(0, offset)];
}

function chordMasks(config: DrillConfig, size: 2 | 3): NoteFrets[] {
  const masks: NoteFrets[] = [];
  for (let mask = 1; mask <= 31; mask += 1) {
    if ((mask & config.allowedFrets) === mask && countFrets(mask) === size) masks.push(mask as NoteFrets);
  }
  requireCondition(masks.length > 0, 'config.allowedFrets', `Pattern requires a ${size}-fret chord.`);
  return masks;
}

function step(unit: number, frets: NoteFrets, articulation: Articulation, segmentId: string, sustain = false): PatternStep {
  return { unit, frets, articulation, segmentId, ...(sustain ? { sustain: true } : {}) };
}

function differentWalk(frets: readonly NoteFrets[], length: number, random: SeededRandom, minimumDistance = 1): NoteFrets[] {
  requireCondition(frets.length >= 2, 'config.allowedFrets', 'Pattern requires at least two frets.');
  const result: NoteFrets[] = [frets[random.nextIndex(frets.length)] as NoteFrets];
  while (result.length < length) {
    const previous = result.at(-1) as NoteFrets;
    const previousIndex = frets.indexOf(previous);
    const candidates = frets.filter((_, index) => Math.abs(index - previousIndex) >= minimumDistance);
    const pool = candidates.length > 0 ? candidates : frets.filter((fret) => fret !== previous);
    result.push(pool[random.nextIndex(pool.length)] as NoteFrets);
  }
  return result;
}

function uniform(values: readonly NoteFrets[], articulation: Articulation, units?: readonly number[], segmentId = 'main'): PatternTemplate {
  const positions = units ?? values.map((_, index) => index);
  requireCondition(values.length === positions.length, 'pattern', 'Pattern values and positions must align.');
  return {
    lengthUnits: (positions.at(-1) ?? 0) + 1,
    steps: values.map((frets, index) => step(positions[index] as number, frets, articulation, segmentId)),
  };
}

function unsupportedPattern(value: never): never {
  void value;
  throw new Error('Unhandled catalog pattern.');
}

function createTemplate(config: DrillConfig, random: SeededRandom): PatternTemplate {
  const id = config.pattern.id as CatalogPatternId;
  const frets = rotated(singleFrets(config), random);
  const first = frets[0] as NoteFrets;
  const second = frets[1] as NoteFrets;
  requireCondition(second !== undefined, 'config.allowedFrets', 'Pattern requires at least two frets.');

  switch (id) {
    case 'single-strum-beginner':
      return uniform([first, first, first, first], 'strum', [0, 2, 4, 6]);
    case 'single-strum-intermediate':
      return uniform(Array.from({ length: 6 }, (_, index) => frets[index % frets.length] as NoteFrets), 'strum');
    case 'single-strum-advanced':
      return uniform(differentWalk(frets, 8, random), 'strum', [0, 1, 2, 4, 5, 6, 8, 10]);

    case 'alternate-strum-beginner':
      return uniform(Array.from({ length: 6 }, () => first), 'strum', [0, 2, 4, 6, 8, 10]);
    case 'alternate-strum-intermediate':
      return uniform(Array.from({ length: 8 }, () => first), 'strum');
    case 'alternate-strum-advanced':
      return uniform([first, first, first, first, second, second, second, second, first, second],
        'strum', [0, 1, 2, 3, 6, 7, 8, 9, 12, 13]);

    case 'hopo-beginner':
      return { lengthUnits: 4, steps: [first, second, first, second].map((value, index) =>
        step(index, value, index === 0 ? 'strum' : 'hopo', 'short-chain')) };
    case 'hopo-intermediate': {
      const ordered = singleFrets(config).slice(0, Math.min(4, frets.length));
      const values = [...ordered, ...ordered.slice(1, -1).reverse()];
      return { lengthUnits: values.length, steps: values.map((value, index) =>
        step(index, value, index === 0 ? 'strum' : 'hopo', 'long-chain')) };
    }
    case 'hopo-advanced': {
      const values = differentWalk(singleFrets(config), 10, random, Math.min(2, frets.length - 1));
      return { lengthUnits: values.length, steps: values.map((value, index) =>
        step(index, value, index === 0 ? 'strum' : 'hopo', 'leaps')) };
    }

    case 'tapping-beginner':
      return uniform([first, second, first, second, first, second], 'tap', undefined, 'alternation');
    case 'tapping-intermediate': {
      const third = frets[2] ?? first;
      return uniform([first, second, first, third, first, second, first, third], 'tap', undefined, 'trill');
    }
    case 'tapping-advanced': {
      const values = differentWalk(singleFrets(config), 10, random, Math.min(2, frets.length - 1));
      return { lengthUnits: values.length, steps: values.map((value, index) =>
        step(index, value, index === 0 || index === 5 ? 'strum' : 'tap', index < 5 ? 'tap-leaps-a' : 'tap-leaps-b')) };
    }

    case 'sequences-beginner':
      return uniform([
        ...singleFrets(config).slice(0, 4),
        ...singleFrets(config).slice(1, 3).reverse(),
      ], 'strum', undefined, 'ascending-descending-stairs');
    case 'sequences-intermediate': {
      const ordered = singleFrets(config).slice(0, Math.min(4, frets.length));
      const values = ordered.flatMap((fret, index) => index + 1 < ordered.length ? [fret, ordered[index + 1] as NoteFrets] : [fret]);
      return uniform(values, 'strum', undefined, 'zigzag');
    }
    case 'sequences-advanced':
      return uniform(differentWalk(singleFrets(config), 10, random, Math.min(2, frets.length - 1)),
        'strum', undefined, 'leaps-and-direction-changes');

    case 'chords-beginner': {
      const doubles = chordMasks(config, 2);
      const chord = doubles[random.nextIndex(doubles.length)] as NoteFrets;
      return uniform([chord, chord, chord, chord], 'strum', [0, 2, 4, 6], 'double-chord');
    }
    case 'chords-intermediate': {
      const doubles = rotated(chordMasks(config, 2), random);
      return uniform([doubles[0] as NoteFrets, first, (doubles[1] ?? doubles[0]) as NoteFrets, second,
        (doubles[2] ?? doubles[0]) as NoteFrets, first, (doubles[1] ?? doubles[0]) as NoteFrets, second],
      'strum', undefined, 'chord-changes');
    }
    case 'chords-advanced': {
      const doubles = rotated(chordMasks(config, 2), random);
      const triples = rotated(chordMasks(config, 3), random);
      return uniform([triples[0] as NoteFrets, doubles[0] as NoteFrets, first, (triples[1] ?? triples[0]) as NoteFrets,
        (doubles[1] ?? doubles[0]) as NoteFrets, second, (triples[2] ?? triples[0]) as NoteFrets, first],
      'strum', undefined, 'triple-changes');
    }

    case 'sustains-beginner':
      return { lengthUnits: 8, steps: [0, 2, 4, 6].map((unit, index) =>
        step(unit, frets[index % frets.length] as NoteFrets, 'strum', 'single-sustains', true)) };
    case 'sustains-intermediate': {
      const doubles = rotated(chordMasks(config, 2), random);
      return { lengthUnits: 12, steps: [0, 3, 6, 9].map((unit, index) =>
        step(unit, doubles[index % doubles.length] as NoteFrets, 'strum', 'chord-sustains', true)) };
    }
    case 'sustains-advanced': {
      const doubles = rotated(chordMasks(config, 2), random);
      const values = [first, doubles[0] as NoteFrets, second, (doubles[1] ?? doubles[0]) as NoteFrets,
        frets[2] ?? first, (doubles[2] ?? doubles[0]) as NoteFrets];
      return { lengthUnits: 12, steps: values.map((value, index) =>
        step(index * 2, value, 'strum', index < 3 ? 'hold-and-change-a' : 'hold-and-change-b', true)) };
    }

    case 'mixed-beginner':
      return { lengthUnits: 10, steps: [
        step(0, first, 'strum', 'strum-block'), step(1, second, 'strum', 'strum-block'),
        step(3, first, 'hopo', 'hopo-block'), step(4, second, 'hopo', 'hopo-block'),
        step(6, first, 'tap', 'tap-block'), step(7, second, 'tap', 'tap-block'),
      ] };
    case 'mixed-intermediate': {
      const doubles = chordMasks(config, 2);
      const double = doubles[random.nextIndex(doubles.length)] as NoteFrets;
      return { lengthUnits: 12, steps: [
        step(0, first, 'strum', 'alternating-a'), step(1, second, 'hopo', 'alternating-a'),
        step(2, first, 'tap', 'alternating-a'), step(4, double, 'strum', 'alternating-b'),
        step(6, second, 'strum', 'alternating-b'), step(7, first, 'hopo', 'alternating-b'),
        step(8, second, 'tap', 'alternating-b'), step(10, double, 'strum', 'alternating-c'),
      ] };
    }
    case 'mixed-advanced': {
      const doubles = rotated(chordMasks(config, 2), random);
      const triples = rotated(chordMasks(config, 3), random);
      const third = frets[2] ?? first;
      return { lengthUnits: 16, steps: [
        step(0, first, 'strum', 'complete-a', true), step(2, second, 'hopo', 'complete-a'),
        step(3, third, 'tap', 'complete-a'), step(4, doubles[0] as NoteFrets, 'strum', 'complete-b', true),
        step(6, first, 'tap', 'complete-b'), step(7, second, 'tap', 'complete-b'),
        step(8, triples[0] as NoteFrets, 'strum', 'complete-c', true), step(10, third, 'strum', 'complete-c'),
        step(11, first, 'hopo', 'complete-c'), step(12, second, 'hopo', 'complete-c'),
        step(13, first, 'tap', 'complete-c'), step(14, (doubles[1] ?? doubles[0]) as NoteFrets, 'strum', 'complete-c'),
      ] };
    }
    default:
      return unsupportedPattern(id);
  }
}

function validateTemplate(config: DrillConfig, template: PatternTemplate, stepTicks: number): void {
  requireCondition(template.steps.length === config.patternLength, 'config.patternLength', 'Pattern length does not match the catalog definition.');
  requireCondition(template.lengthUnits > 0 && Number.isInteger(template.lengthUnits), 'pattern.length', 'Pattern length must use whole grid units.');
  const hasSustains = template.steps.some((patternStep) => patternStep.sustain);
  requireCondition(hasSustains === (config.sustainTicks > 0), 'config.sustainTicks',
    'Sustain duration must match the catalog pattern.');
  requireCondition(config.technique !== 'alternate-strum' || config.strumDirectionGoal.kind === 'alternate',
    'config.strumDirectionGoal', 'Alternate strum patterns require alternating directions.');
  for (const [index, current] of template.steps.entries()) {
    const next = template.steps[index + 1];
    const durationTicks = current.sustain ? config.sustainTicks : 0;
    requireCondition(Number.isInteger(current.unit) && current.unit >= 0 && current.unit < template.lengthUnits,
      `pattern.steps[${index}].unit`, 'Pattern step is outside its cycle.');
    requireCondition(index === 0 || (template.steps[index - 1]?.unit ?? -1) < current.unit,
      `pattern.steps[${index}].unit`, 'Pattern steps must increase.');
    requireCondition((current.frets & config.allowedFrets) === current.frets && countFrets(current.frets) <= config.chordSize,
      `pattern.steps[${index}].frets`, 'Generated step exceeds the allowed frets or chord size.');
    requireCondition(countFrets(current.frets) === 1 || current.articulation === 'strum',
      `pattern.steps[${index}].articulation`, 'Generated chords require strum.');
    requireCondition(config.articulation === 'mixed' || current.articulation === config.articulation,
      `pattern.steps[${index}].articulation`, 'Generated articulation conflicts with the configuration.');
    const nextTick = (next?.unit ?? template.lengthUnits) * stepTicks;
    requireCondition(current.unit * stepTicks + durationTicks <= nextTick,
      `pattern.steps[${index}].durationTicks`, 'Generated sustain overlaps the next step or cycle.');
  }
}

export function generateCatalogDrill(config: DrillConfig): Chart {
  requireCondition(isCatalogPattern(config.pattern.id, config.pattern.version), 'config.pattern', 'Catalog pattern is not supported.', 'unsupported');
  const definition = PATTERN_DEFINITIONS[config.pattern.id];
  requireCondition(config.technique === definition.technique && config.level === definition.level,
    'config.pattern', 'Pattern does not match its technique and level.');
  const stepTicks = TICKS_PER_QUARTER / config.subdivision;
  readInteger(stepTicks, 'pattern.stepTicks', 1, limits.maximumTicks);
  const template = createTemplate(config, createSeededRandom(config.seed));
  validateTemplate(config, template, stepTicks);
  const cycleTicks = template.lengthUnits * stepTicks;
  const lengthTicks = config.length.kind === 'repetitions' ? cycleTicks * config.length.count : config.length.ticks;
  readInteger(lengthTicks, 'chart.lengthTicks', 1, limits.maximumTicks);
  requireCondition((lengthTicks * 60_000) / (config.bpm * TICKS_PER_QUARTER) <= limits.maximumDurationMs,
    'chart.lengthTicks', 'Attempt exceeds ten minutes.', 'resource-limit');

  const identity = `${CATALOG_GENERATOR.id}@${CATALOG_GENERATOR.version}:${hashSeed(JSON.stringify(config)).toString(16)}`;
  const notes: ChartNote[] = [];
  let nextDirection: StrumDirection = config.strumDirectionGoal.kind === 'alternate'
    ? config.strumDirectionGoal.firstDirection : 'down';
  let previousArticulation: Articulation | null = null;
  let previousEndTick = 0;
  let previousSegmentId: string | null = null;
  for (let repetition = 0; repetition * cycleTicks < lengthTicks; repetition += 1) {
    for (const templateStep of template.steps) {
      const tick = repetition * cycleTicks + templateStep.unit * stepTicks;
      const durationTicks = templateStep.sustain ? config.sustainTicks : 0;
      if (tick + durationTicks > lengthTicks) continue;
      requireCondition(notes.length < limits.maximumNotes, 'chart.notes', 'Chart exceeds the note limit.', 'resource-limit');
      const segmentId = `${config.pattern.id}:${repetition}:${templateStep.segmentId}`;
      let expectedStrumDirection: StrumDirection | null = null;
      if (templateStep.articulation === 'strum' && config.strumDirectionGoal.kind === 'fixed') {
        expectedStrumDirection = config.strumDirectionGoal.direction;
      } else if (templateStep.articulation === 'strum' && config.strumDirectionGoal.kind === 'alternate') {
        if (previousArticulation !== 'strum' || previousSegmentId !== segmentId
          || tick - previousEndTick >= config.strumDirectionGoal.resetAfterRestTicks) {
          nextDirection = config.strumDirectionGoal.firstDirection;
        }
        expectedStrumDirection = nextDirection;
        nextDirection = nextDirection === 'down' ? 'up' : 'down';
      }
      notes.push({
        id: `${identity}:note:${notes.length}`,
        tick,
        frets: templateStep.frets,
        durationTicks,
        articulation: templateStep.articulation,
        origin: { segmentId, patternId: config.pattern.id, technique: config.technique, repetition },
        expectedStrumDirection,
      });
      previousArticulation = templateStep.articulation;
      previousEndTick = tick + durationTicks;
      previousSegmentId = segmentId;
    }
  }
  requireCondition(notes.length > 0, 'chart.notes', 'Configuration does not fit a complete note.');
  return immutableCopy({
    id: identity,
    ticksPerQuarter: TICKS_PER_QUARTER,
    bpm: config.bpm,
    lengthTicks,
    generator: CATALOG_GENERATOR,
    seed: config.seed,
    notes,
  });
}
