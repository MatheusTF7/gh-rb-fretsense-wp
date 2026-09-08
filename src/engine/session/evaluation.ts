import type { RatioMetric, RecordAvailability, SessionMetrics, SessionSnapshot, TimingMetrics } from '../domain';
import { immutableCopy } from '../domain/immutable';
import { ENGINE_LIMITS as limits } from '../domain/limits';
import { readBoolean, readChoice, readInteger, readNumber, readRecord, readString, requireCondition } from '../domain/validation';

/** Resultado do julgador da etapa 06; a sessão não inventa acertos ou misses. */
export interface SessionEvaluation {
  readonly sessionId: string;
  /** Horizonte musical corrigido já processado pelo julgador. */
  readonly throughTimeMs: number;
  readonly metrics: SessionMetrics;
  readonly pendingSustains: number;
  readonly judgmentCount: number;
  readonly judgmentRecords: RecordAvailability;
  /** Inclui lacunas em subconjuntos de uma métrica técnica aparentemente disponível. */
  readonly requiredTechniqueDataComplete: boolean;
}

function unavailable(value: Record<string, unknown>, path: string) {
  readChoice(value.status, ['unavailable'], `${path}.status`);
  return {
    status: 'unavailable' as const,
    reason: readChoice(value.reason, ['no-samples', 'insufficient-data', 'unsupported-capability', 'not-applicable'], `${path}.reason`),
  };
}

function readRatio(value: unknown, path: string): RatioMetric {
  const metric = readRecord(value, path);
  if (metric.status !== 'available') return unavailable(metric, path);
  const denominator = readInteger(metric.denominator, `${path}.denominator`, 1, limits.maximumJudgmentEvents);
  const numerator = readInteger(metric.numerator, `${path}.numerator`, 0, denominator);
  const ratio = readNumber(metric.value, `${path}.value`, 0, 1);
  readChoice(metric.unit, ['ratio'], `${path}.unit`);
  requireCondition(Math.abs(ratio - numerator / denominator) <= Number.EPSILON * 8, path, 'Ratio does not match its counts.');
  return { status: 'available', unit: 'ratio', numerator, denominator, value: ratio };
}

function readTiming(value: unknown, hitNotes: number, snapshot: SessionSnapshot): TimingMetrics {
  const metric = readRecord(value, 'evaluation.metrics.timing');
  if (metric.status !== 'available') return unavailable(metric, 'evaluation.metrics.timing');
  const sampleCount = readInteger(metric.sampleCount, 'timing.sampleCount', 1, limits.maximumNotes);
  readChoice(metric.unit, ['milliseconds'], 'timing.unit');
  requireCondition(sampleCount === hitNotes, 'timing.sampleCount', 'Timing samples must match hit notes.');
  const maximumError = Math.max(snapshot.rules.hitWindow.earlyMs, snapshot.rules.hitWindow.lateMs);
  const meanErrorMs = readNumber(metric.meanErrorMs, 'timing.meanErrorMs', -snapshot.rules.hitWindow.earlyMs, snapshot.rules.hitWindow.lateMs);
  const meanAbsoluteErrorMs = readNumber(metric.meanAbsoluteErrorMs, 'timing.meanAbsoluteErrorMs', 0, maximumError);
  requireCondition(meanAbsoluteErrorMs + 1e-9 >= Math.abs(meanErrorMs), 'timing.meanAbsoluteErrorMs', 'Absolute error cannot be less than absolute mean error.');
  return { status: 'available', unit: 'milliseconds', sampleCount, meanErrorMs, meanAbsoluteErrorMs,
    populationStdDevMs: readNumber(metric.populationStdDevMs, 'timing.populationStdDevMs', 0, maximumError) };
}

export function parseSessionEvaluation(value: unknown, snapshot: SessionSnapshot, judgedNowMs: number): SessionEvaluation {
  const evaluation = readRecord(value, 'evaluation');
  const sessionId = readString(evaluation.sessionId, 'evaluation.sessionId');
  requireCondition(sessionId === snapshot.id, 'evaluation.sessionId', 'Evaluation belongs to another attempt.');
  const throughTimeMs = readNumber(evaluation.throughTimeMs, 'evaluation.throughTimeMs', -limits.maximumOffsetMs, judgedNowMs);
  const metrics = readRecord(evaluation.metrics, 'evaluation.metrics');
  const count = (key: string, max: number = limits.maximumNotes) => readInteger(metrics[key], `evaluation.metrics.${key}`, 0, max);
  const plannedNotes = count('plannedNotes');
  const hitNotes = count('hitNotes');
  const missedNotes = count('missedNotes');
  const unjudgedNotes = count('unjudgedNotes');
  requireCondition(plannedNotes === snapshot.chart.notes.length && hitNotes + missedNotes + unjudgedNotes === plannedNotes,
    'evaluation.metrics', 'Note counts do not match the chart.');
  const noteAccuracy = readRatio(metrics.noteAccuracy, 'evaluation.metrics.noteAccuracy');
  requireCondition(hitNotes + missedNotes === 0 ? noteAccuracy.status === 'unavailable'
    : noteAccuracy.status === 'available' && noteAccuracy.numerator === hitNotes && noteAccuracy.denominator === hitNotes + missedNotes,
    'evaluation.metrics.noteAccuracy', 'Accuracy does not match the resolved notes.');
  const bestCombo = count('bestCombo', hitNotes);
  const finalCombo = count('finalCombo', bestCombo);
  const extraStrums = count('extraStrums', limits.maximumInputEvents);
  const sustainCount = snapshot.chart.notes.filter((note) => note.durationTicks > 0).length;
  const brokenSustains = count('brokenSustains', Math.min(sustainCount, hitNotes));
  const articulationCompliance = readRatio(metrics.articulationCompliance, 'evaluation.metrics.articulationCompliance');
  const strumDirectionCompliance = readRatio(metrics.strumDirectionCompliance, 'evaluation.metrics.strumDirectionCompliance');
  const sustainCompletion = readRatio(metrics.sustainCompletion, 'evaluation.metrics.sustainCompletion');
  for (const ratio of [articulationCompliance, strumDirectionCompliance, sustainCompletion]) {
    requireCondition(ratio.status === 'unavailable' || ratio.denominator <= hitNotes, 'evaluation.metrics', 'Technical samples cannot exceed hits.');
  }
  const pendingSustains = readInteger(evaluation.pendingSustains, 'evaluation.pendingSustains', 0, Math.min(sustainCount, hitNotes));
  if (sustainCompletion.status === 'available') {
    requireCondition(sustainCompletion.denominator - sustainCompletion.numerator === brokenSustains
      && sustainCompletion.denominator + pendingSustains <= Math.min(sustainCount, hitNotes), 'evaluation.metrics.sustainCompletion', 'Sustain counts do not match.');
  }
  const judgmentCount = readInteger(evaluation.judgmentCount, 'evaluation.judgmentCount', 0, limits.maximumJudgmentEvents);
  requireCondition(judgmentCount >= hitNotes + missedNotes + extraStrums + brokenSustains, 'evaluation.judgmentCount', 'Judgment count is insufficient.');
  return immutableCopy({
    sessionId, throughTimeMs, pendingSustains, judgmentCount,
    judgmentRecords: readChoice(evaluation.judgmentRecords, ['complete', 'partial', 'not-recorded', 'discarded'], 'evaluation.judgmentRecords'),
    requiredTechniqueDataComplete: readBoolean(evaluation.requiredTechniqueDataComplete, 'evaluation.requiredTechniqueDataComplete'),
    metrics: { plannedNotes, hitNotes, missedNotes, unjudgedNotes, extraStrums, brokenSustains,
      bestCombo, finalCombo, noteAccuracy, timing: readTiming(metrics.timing, hitNotes, snapshot),
      articulationCompliance, strumDirectionCompliance, sustainCompletion },
  });
}

export function createUnjudgedMetrics(plannedNotes: number): SessionMetrics {
  const missing = { status: 'unavailable', reason: 'insufficient-data' } as const;
  return immutableCopy({ plannedNotes, hitNotes: 0, missedNotes: 0, unjudgedNotes: plannedNotes,
    extraStrums: 0, brokenSustains: 0, bestCombo: 0, finalCombo: 0,
    noteAccuracy: missing, timing: missing, articulationCompliance: missing,
    strumDirectionCompliance: missing, sustainCompletion: missing });
}
