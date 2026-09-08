import type { Articulation, Chart, ChartNote, DrillConfig, StrumDirection } from '../domain';
import { TICKS_PER_QUARTER } from '../domain/music';
import { ENGINE_LIMITS as limits } from '../domain/limits';
import { immutableCopy } from '../domain/immutable';
import { readInteger, requireCondition } from '../domain/validation';
import { hashSeed } from './random';

export const MANUAL_GENERATOR = Object.freeze({ id: 'manual-pattern-generator', version: '1.0.0' });

export function generateManualDrill(config: DrillConfig): Chart {
  const pattern = config.manualPattern;
  requireCondition(pattern !== undefined, 'config.manualPattern', 'Manual pattern data is required.');
  const lengthTicks = config.length.kind === 'repetitions'
    ? pattern.lengthTicks * config.length.count
    : config.length.ticks;
  readInteger(lengthTicks, 'chart.lengthTicks', 1, limits.maximumTicks);
  requireCondition((lengthTicks * 60_000) / (config.bpm * TICKS_PER_QUARTER) <= limits.maximumDurationMs,
    'chart.lengthTicks', 'Attempt exceeds ten minutes.', 'resource-limit');

  const identity = `${MANUAL_GENERATOR.id}@${MANUAL_GENERATOR.version}:${hashSeed(JSON.stringify(config)).toString(16)}`;
  const notes: ChartNote[] = [];
  let nextDirection: StrumDirection = config.strumDirectionGoal.kind === 'alternate'
    ? config.strumDirectionGoal.firstDirection : 'down';
  let previousArticulation: Articulation | null = null;
  let previousEndTick = 0;
  let previousSegmentId: string | null = null;

  for (let repetition = 0; repetition * pattern.lengthTicks < lengthTicks; repetition += 1) {
    for (const patternStep of pattern.steps) {
      const tick = repetition * pattern.lengthTicks + patternStep.tick;
      if (tick + patternStep.durationTicks > lengthTicks) continue;
      requireCondition(notes.length < limits.maximumNotes, 'chart.notes', 'Chart exceeds the note limit.', 'resource-limit');
      const segmentId = `manual:${repetition}:${patternStep.segmentId}`;
      let expectedStrumDirection: StrumDirection | null = null;
      if (patternStep.articulation === 'strum' && config.strumDirectionGoal.kind === 'fixed') {
        expectedStrumDirection = config.strumDirectionGoal.direction;
      } else if (patternStep.articulation === 'strum' && config.strumDirectionGoal.kind === 'alternate') {
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
        frets: patternStep.frets,
        durationTicks: patternStep.durationTicks,
        articulation: patternStep.articulation,
        origin: { segmentId, patternId: config.pattern.id, technique: config.technique, repetition },
        expectedStrumDirection,
      });
      previousArticulation = patternStep.articulation;
      previousEndTick = tick + patternStep.durationTicks;
      previousSegmentId = segmentId;
    }
  }
  requireCondition(notes.length > 0, 'chart.notes', 'Configuration does not fit a complete note.');
  return immutableCopy({
    id: identity,
    ticksPerQuarter: TICKS_PER_QUARTER,
    bpm: config.bpm,
    lengthTicks,
    generator: MANUAL_GENERATOR,
    seed: config.seed,
    notes,
  });
}
