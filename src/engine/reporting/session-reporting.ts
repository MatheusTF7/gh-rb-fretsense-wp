import type { RatioMetric, TimingMetrics, VersionedReference } from '../domain';
import { immutableCopy } from '../domain';
import {
  REPORTING_POLICY,
  type EvolutionDashboard,
  type EvolutionGroup,
  type EvolutionPoint,
  type ReportingAttempt,
  type SessionComparison,
  type SessionConditionDifference,
  type SessionExecutionDetails,
  type TimingDistributionBin,
  type TimingDistributionBinId,
} from './contracts';

function sameReference(left: VersionedReference | null, right: VersionedReference | null): boolean {
  return left === null || right === null
    ? left === right
    : left.id === right.id && left.version === right.version;
}

function sameData(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function calibrationCondition(attempt: ReportingAttempt) {
  const calibration = attempt.snapshot.calibration;
  return {
    method: calibration.method,
    judgmentOffsetMs: calibration.judgmentOffsetMs,
    visualOffsetMs: calibration.visualOffsetMs,
    audioMode: calibration.context.audioMode,
    deviceProfile: calibration.deviceProfile,
    context: calibration.context,
  };
}

export function buildSessionExecutionDetails(attempt: ReportingAttempt): SessionExecutionDetails {
  const hitErrors = attempt.judgments?.flatMap((event) => event.kind === 'note-hit' ? [event.timingErrorMs] : []) ?? null;
  let timingDistribution: SessionExecutionDetails['timingDistribution'];
  if (hitErrors === null) {
    timingDistribution = { status: 'unavailable', reason: 'raw-events-unavailable' };
  } else if (hitErrors.length === 0) {
    timingDistribution = { status: 'unavailable', reason: 'no-samples' };
  } else {
    const earlyLimit = -attempt.snapshot.rules.hitWindow.earlyMs;
    const lateLimit = attempt.snapshot.rules.hitWindow.lateMs;
    const veryEarlyEnd = -Math.min(40, attempt.snapshot.rules.hitWindow.earlyMs);
    const earlyEnd = -Math.min(15, attempt.snapshot.rules.hitWindow.earlyMs);
    const lateStart = Math.min(15, lateLimit);
    const veryLateStart = Math.min(40, lateLimit);
    const definitions: readonly [TimingDistributionBinId, number, number][] = [
      ['very-early', earlyLimit, veryEarlyEnd],
      ['early', veryEarlyEnd, earlyEnd],
      ['centered', earlyEnd, lateStart],
      ['late', lateStart, veryLateStart],
      ['very-late', veryLateStart, lateLimit],
    ];
    const bins: TimingDistributionBin[] = definitions.map(([id, minimumMs, maximumMs], index) => {
      const count = hitErrors.filter((value) => index === definitions.length - 1
        ? value >= minimumMs && value <= maximumMs
        : value >= minimumMs && value < maximumMs).length;
      return { id, minimumMs, maximumMs, count, ratio: count / hitErrors.length };
    });
    timingDistribution = { status: 'available', sampleCount: hitErrors.length, bins };
  }

  const analysis = attempt.result.analysis;
  let patternErrors: SessionExecutionDetails['patternErrors'];
  if (!analysis) {
    patternErrors = { status: 'unavailable', reason: 'analysis-not-performed' };
  } else {
    const codesByNote = new Map<string, Set<string>>();
    for (const diagnostic of analysis.diagnostics) {
      for (const evidence of diagnostic.evidence) {
        for (const noteId of evidence.noteIds) {
          const codes = codesByNote.get(noteId) ?? new Set<string>();
          codes.add(diagnostic.code);
          codesByNote.set(noteId, codes);
        }
      }
    }
    const allRows = attempt.snapshot.chart.notes.flatMap((note) => {
      const codes = codesByNote.get(note.id);
      return codes ? [{
        noteId: note.id,
        tick: note.tick,
        positionRatio: attempt.snapshot.chart.lengthTicks > 0
          ? note.tick / attempt.snapshot.chart.lengthTicks : 0,
        segmentId: note.origin.segmentId,
        expectedFrets: note.frets,
        diagnosticCodes: [...codes],
      }] : [];
    });
    const rows = allRows.slice(0, REPORTING_POLICY.maximumPatternErrorRows);
    patternErrors = {
      status: 'available',
      rows,
      referencedNotes: allRows.length,
      omittedRows: allRows.length - rows.length,
    };
  }
  return immutableCopy({ policy: REPORTING_POLICY, timingDistribution, patternErrors });
}

export function compareSessionConditions(
  current: ReportingAttempt,
  candidate: ReportingAttempt,
): readonly SessionConditionDifference[] {
  const differences: SessionConditionDifference[] = [];
  const left = current.snapshot;
  const right = candidate.snapshot;
  if (left.mode !== right.mode) differences.push('mode');
  if (left.config.technique !== right.config.technique) differences.push('technique');
  if (left.config.level !== right.config.level) differences.push('level');
  if (left.config.bpm !== right.config.bpm) differences.push('bpm');
  if (left.chart.id !== right.chart.id || !sameData(left.chart, right.chart)) differences.push('chart');
  if (!sameReference(left.rules, right.rules)) differences.push('rule');
  if (!sameData(left.rules.hitWindow, right.rules.hitWindow)) differences.push('hit-window');
  if (!sameReference(current.presentation, candidate.presentation)) differences.push('presentation');
  if (!sameReference(current.gameEdition, candidate.gameEdition)) differences.push('game-edition');
  if (!sameReference(left.device, right.device)) differences.push('device');
  if (!sameData(calibrationCondition(current), calibrationCondition(candidate))) differences.push('calibration');
  return immutableCopy(differences);
}

function metricValue(metric: RatioMetric): number | null;
function metricValue(metric: TimingMetrics, key: 'meanAbsoluteErrorMs'): number | null;
function metricValue(metric: RatioMetric | TimingMetrics, key?: 'meanAbsoluteErrorMs'): number | null {
  if (metric.status !== 'available') return null;
  return key ? (metric as Extract<TimingMetrics, { status: 'available' }>)[key]
    : (metric as Extract<RatioMetric, { status: 'available' }>).value;
}

export function compareWithPrevious(
  current: ReportingAttempt,
  previous: readonly ReportingAttempt[],
): SessionComparison {
  const ordered = [...previous]
    .filter((attempt) => attempt.result.endedAtIso < current.result.endedAtIso)
    .sort((left, right) => right.result.endedAtIso.localeCompare(left.result.endedAtIso));
  if (!ordered.length) return { status: 'none' };
  const compatible = ordered.find((attempt) => compareSessionConditions(current, attempt).length === 0);
  const candidate = compatible ?? ordered[0];
  if (!candidate) return { status: 'none' };
  const differences = compareSessionConditions(current, candidate);
  if (differences.length) {
    return immutableCopy({
      status: 'incompatible',
      candidateSessionId: candidate.result.sessionId,
      candidateEndedAtIso: candidate.result.endedAtIso,
      differences,
    });
  }
  const currentAccuracy = metricValue(current.result.metrics.noteAccuracy);
  const previousAccuracy = metricValue(candidate.result.metrics.noteAccuracy);
  const currentTiming = metricValue(current.result.metrics.timing, 'meanAbsoluteErrorMs');
  const previousTiming = metricValue(candidate.result.metrics.timing, 'meanAbsoluteErrorMs');
  return immutableCopy({
    status: 'compatible',
    candidateSessionId: candidate.result.sessionId,
    candidateEndedAtIso: candidate.result.endedAtIso,
    accuracyDelta: currentAccuracy === null || previousAccuracy === null ? null : currentAccuracy - previousAccuracy,
    timingAbsoluteDeltaMs: currentTiming === null || previousTiming === null ? null : currentTiming - previousTiming,
  });
}

function meetsConfiguredGoals(attempt: ReportingAttempt): boolean {
  const { config } = attempt.snapshot;
  const { metrics } = attempt.result;
  if (attempt.result.ending.state !== 'completed' || !attempt.result.progression.eligible
    || metrics.plannedNotes < REPORTING_POLICY.minimumNotesPerAttempt
    || metrics.noteAccuracy.status !== 'available' || metrics.noteAccuracy.value < config.goals.minimumAccuracy
    || metrics.missedNotes + metrics.extraStrums + metrics.brokenSustains > config.goals.maximumErrors) return false;
  if (config.goals.requireArticulation
    && (metrics.articulationCompliance.status !== 'available' || metrics.articulationCompliance.value < 1)) return false;
  if (config.goals.requireStrumDirection
    && (metrics.strumDirectionCompliance.status !== 'available' || metrics.strumDirectionCompliance.value < 1)) return false;
  if (config.goals.requireFullSustains
    && (metrics.sustainCompletion.status !== 'available' || metrics.sustainCompletion.value < 1)) return false;
  return config.technique !== 'alternate-strum'
    || (attempt.snapshot.device.capabilities.strum === 'directional'
      && metrics.strumDirectionCompliance.status === 'available');
}

function evolutionGroupKey(attempt: ReportingAttempt): string {
  const snapshot = attempt.snapshot;
  const config = snapshot.config;
  return JSON.stringify({
    mode: snapshot.mode,
    technique: config.technique,
    level: config.level,
    pattern: config.pattern,
    subdivision: config.subdivision,
    allowedFrets: config.allowedFrets,
    patternLength: config.patternLength,
    length: config.length,
    manualPattern: config.manualPattern ?? null,
    articulation: config.articulation,
    automaticStrum: config.automaticStrum,
    chordSize: config.chordSize,
    sustainTicks: config.sustainTicks,
    strumDirectionGoal: config.strumDirectionGoal,
    goals: config.goals,
    rules: snapshot.rules,
    generator: snapshot.chart.generator,
    presentation: attempt.presentation,
    gameEdition: attempt.gameEdition,
    device: { id: snapshot.device.id, version: snapshot.device.version },
    calibration: calibrationCondition(attempt),
  });
}

function buildEvolutionGroup(attempts: readonly ReportingAttempt[], index: number): EvolutionGroup {
  const first = attempts[0] as ReportingAttempt;
  const points: EvolutionPoint[] = [...attempts]
    .sort((left, right) => left.result.endedAtIso.localeCompare(right.result.endedAtIso))
    .map((attempt) => ({
      sessionId: attempt.result.sessionId,
      endedAtIso: attempt.result.endedAtIso,
      bpm: attempt.snapshot.config.bpm,
      chartId: attempt.snapshot.chart.id,
      accuracy: attempt.result.metrics.noteAccuracy.status === 'available'
        ? attempt.result.metrics.noteAccuracy.value : null,
      eligible: attempt.result.ending.state === 'completed' && attempt.result.progression.eligible,
      sampleSufficient: attempt.result.metrics.plannedNotes >= REPORTING_POLICY.minimumNotesPerAttempt,
      meetsGoals: meetsConfiguredGoals(attempt),
    }));
  const bpmBuckets = new Map<number, EvolutionPoint[]>();
  for (const point of points) {
    const bucket = bpmBuckets.get(point.bpm) ?? [];
    bucket.push(point);
    bpmBuckets.set(point.bpm, bucket);
  }
  const consistent = [...bpmBuckets]
    .filter(([, bucket]) => bucket.filter((point) => point.meetsGoals).length >= REPORTING_POLICY.minimumEvolutionAttempts)
    .sort(([left], [right]) => right - left)[0];
  const sufficientAttempts = points.filter((point) => point.eligible && point.sampleSufficient
    && point.accuracy !== null).length;
  const demonstratedBpm: EvolutionGroup['demonstratedBpm'] = consistent
    ? {
        status: 'available',
        value: consistent[0],
        supportingAttempts: consistent[1].filter((point) => point.meetsGoals).length,
      }
    : {
        status: 'unavailable',
        reason: sufficientAttempts < REPORTING_POLICY.minimumEvolutionAttempts
          ? 'insufficient-samples' : 'no-consistent-bpm',
        observedAttempts: sufficientAttempts,
      };
  const bpms = points.map((point) => point.bpm);
  return immutableCopy({
    id: `evolution-group-${index}`,
    technique: first.snapshot.config.technique,
    level: first.snapshot.config.level,
    mode: first.snapshot.mode,
    pattern: first.snapshot.config.pattern,
    rule: { id: first.snapshot.rules.id, version: first.snapshot.rules.version },
    hitWindow: {
      earlyMs: first.snapshot.rules.hitWindow.earlyMs,
      lateMs: first.snapshot.rules.hitWindow.lateMs,
    },
    presentation: first.presentation,
    gameEdition: first.gameEdition,
    calibration: {
      method: first.snapshot.calibration.method,
      judgmentOffsetMs: first.snapshot.calibration.judgmentOffsetMs,
      visualOffsetMs: first.snapshot.calibration.visualOffsetMs,
      audioMode: first.snapshot.calibration.context.audioMode,
    },
    device: { id: first.snapshot.device.id, version: first.snapshot.device.version },
    attemptCount: points.length,
    eligibleAttemptCount: points.filter((point) => point.eligible).length,
    distinctChartCount: new Set(points.map((point) => point.chartId)).size,
    minimumObservedBpm: Math.min(...bpms),
    maximumObservedBpm: Math.max(...bpms),
    demonstratedBpm,
    points,
  });
}

export function buildEvolutionDashboard(attempts: readonly ReportingAttempt[]): EvolutionDashboard {
  const groups = new Map<string, ReportingAttempt[]>();
  for (const attempt of attempts) {
    const key = evolutionGroupKey(attempt);
    const group = groups.get(key) ?? [];
    group.push(attempt);
    groups.set(key, group);
  }
  const built = [...groups.values()].map(buildEvolutionGroup)
    .sort((left, right) => right.attemptCount - left.attemptCount
      || left.technique.localeCompare(right.technique)
      || left.level.localeCompare(right.level));
  return immutableCopy({ policy: REPORTING_POLICY, attemptCount: attempts.length, groups: built });
}
