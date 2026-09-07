import type { DrillConfig, StrumDirectionGoal } from './drill';
import { TICKS_PER_QUARTER } from './music';
import { FRETSENSE_V1_RULE_PROFILE } from './rules';
import { ENGINE_LIMITS as limits } from './limits';
import { immutableCopy } from './immutable';
import {
  countFrets, readBoolean, readChoice, readInteger, readNoteFrets, readNumber,
  readRecord, readReference, readString, requireCondition, sameReference,
} from './validation';

export const TECHNIQUES = [
  'single-strum', 'alternate-strum', 'hopo', 'tapping', 'sequences', 'chords', 'sustains', 'mixed',
] as const;

/** Aceita dados desconhecidos e devolve apenas os campos reconhecidos, copiados e congelados. */
export function parseDrillConfig(value: unknown): DrillConfig {
  const config = readRecord(value, 'config');
  const length = readRecord(config.length, 'config.length');
  const lengthKind = readChoice(length.kind, ['repetitions', 'duration'], 'config.length.kind');
  requireCondition(lengthKind === 'repetitions' ? !('ticks' in length) : !('count' in length),
    'config.length', 'Choose repetitions or duration, never both.');
  const direction = readRecord(config.strumDirectionGoal, 'config.strumDirectionGoal');
  const directionKind = readChoice(direction.kind, ['none', 'fixed', 'alternate'], 'config.strumDirectionGoal.kind');
  let strumDirectionGoal: StrumDirectionGoal = { kind: 'none' };
  if (directionKind === 'fixed') {
    strumDirectionGoal = { kind: 'fixed', direction: readChoice(direction.direction, ['up', 'down'], 'config.strumDirectionGoal.direction') };
  } else if (directionKind === 'alternate') {
    strumDirectionGoal = {
      kind: 'alternate',
      firstDirection: readChoice(direction.firstDirection, ['up', 'down'], 'config.strumDirectionGoal.firstDirection'),
      resetAfterRestTicks: readInteger(direction.resetAfterRestTicks, 'config.strumDirectionGoal.resetAfterRestTicks', 1, limits.maximumTicks),
    };
  }
  const goals = readRecord(config.goals, 'config.goals');
  const parsed: DrillConfig = {
    schemaVersion: readChoice(config.schemaVersion, [1], 'config.schemaVersion'),
    technique: readChoice(config.technique, TECHNIQUES, 'config.technique'),
    level: readChoice(config.level, ['beginner', 'intermediate', 'advanced'], 'config.level'),
    pattern: readReference(config.pattern, 'config.pattern'),
    bpm: readNumber(config.bpm, 'config.bpm', limits.minimumBpm, limits.maximumBpm),
    subdivision: readChoice(config.subdivision, [1, 2, 3, 4, 6, 8], 'config.subdivision'),
    allowedFrets: readNoteFrets(config.allowedFrets, 'config.allowedFrets'),
    patternLength: readInteger(config.patternLength, 'config.patternLength', 1, limits.maximumPatternLength),
    length: lengthKind === 'repetitions'
      ? { kind: 'repetitions', count: readInteger(length.count, 'config.length.count', 1, limits.maximumRepetitions) }
      : { kind: 'duration', ticks: readInteger(length.ticks, 'config.length.ticks', 1, limits.maximumTicks) },
    articulation: readChoice(config.articulation, ['strum', 'hopo', 'tap', 'mixed'], 'config.articulation'),
    automaticStrum: config.automaticStrum === undefined
      ? false : readBoolean(config.automaticStrum, 'config.automaticStrum'),
    chordSize: readChoice(config.chordSize, [1, 2, 3], 'config.chordSize'),
    sustainTicks: readInteger(config.sustainTicks, 'config.sustainTicks', 0, limits.maximumTicks),
    strumDirectionGoal,
    goals: {
      minimumAccuracy: readNumber(goals.minimumAccuracy, 'config.goals.minimumAccuracy', 0, 1),
      maximumErrors: readInteger(goals.maximumErrors, 'config.goals.maximumErrors', 0, limits.maximumJudgmentEvents),
      consistentAttempts: readInteger(goals.consistentAttempts, 'config.goals.consistentAttempts', 1, limits.maximumRepetitions),
      requireArticulation: readBoolean(goals.requireArticulation, 'config.goals.requireArticulation'),
      requireStrumDirection: readBoolean(goals.requireStrumDirection, 'config.goals.requireStrumDirection'),
      requireFullSustains: readBoolean(goals.requireFullSustains, 'config.goals.requireFullSustains'),
    },
    seed: readString(config.seed, 'config.seed'),
    ruleProfile: readReference(config.ruleProfile, 'config.ruleProfile'),
  };
  requireCondition(sameReference(parsed.ruleProfile, FRETSENSE_V1_RULE_PROFILE), 'config.ruleProfile', 'Only fretsense-v1@1.0.0 is implemented.', 'unsupported');
  requireCondition(parsed.chordSize <= countFrets(parsed.allowedFrets), 'config.chordSize', 'Not enough allowed frets.');
  requireCondition(parsed.chordSize === 1 || parsed.articulation === 'strum', 'config.articulation', 'Chords require strum.');
  requireCondition(parsed.strumDirectionGoal.kind === 'none' || parsed.articulation === 'strum', 'config.strumDirectionGoal', 'Direction goals require strum notes.');
  requireCondition(!parsed.goals.requireStrumDirection || parsed.strumDirectionGoal.kind !== 'none', 'config.goals.requireStrumDirection', 'A direction goal is required.');
  requireCondition(!parsed.goals.requireFullSustains || parsed.sustainTicks > 0, 'config.goals.requireFullSustains', 'A sustain duration is required.');
  return immutableCopy(parsed);
}

/** Geometria dos geradores iniciais, calculada antes de alocar notas. */
export function getDrillGeometry(config: DrillConfig) {
  const stepTicks = TICKS_PER_QUARTER / config.subdivision;
  requireCondition(config.sustainTicks <= stepTicks, 'config.sustainTicks', 'This grid does not support overlapping sustains.');
  const lengthTicks = config.length.kind === 'repetitions'
    ? config.patternLength * config.length.count * stepTicks
    : config.length.ticks;
  const noteCount = Math.min(
    Math.ceil(lengthTicks / stepTicks),
    Math.floor((lengthTicks - config.sustainTicks) / stepTicks) + 1,
  );
  readInteger(lengthTicks, 'chart.lengthTicks', 1, limits.maximumTicks);
  readInteger(noteCount, 'chart.notes.length', 1, limits.maximumNotes);
  requireCondition((lengthTicks * 60_000) / (config.bpm * TICKS_PER_QUARTER) <= limits.maximumDurationMs,
    'chart.lengthTicks', 'Attempt exceeds ten minutes.', 'resource-limit');
  return { stepTicks, lengthTicks, noteCount };
}
