import { DRILL_PRESETS, getTechniqueDescriptor } from '@/catalog';
import type {
  ChartNote, DiagnosticCode, DrillConfig, DrillLevel, EvidenceReference, SessionAnalysisReport,
  TrainingDiagnostic, TrainingRecommendation,
} from '../domain';
import { immutableCopy, MANUAL_PATTERN_REFERENCE, parseDrillConfig } from '../domain';
import type {
  AdaptationAttempt, AdaptationEvaluation, AdaptationPolicy,
} from './contracts';
import { CORRECTIVE_DIAGNOSTIC_CODES, DEFAULT_ADAPTATION_POLICY } from './contracts';

const LEVELS: readonly DrillLevel[] = ['beginner', 'intermediate', 'advanced'];
const TRANSITION_CODES: readonly DiagnosticCode[] = ['sequence-inversion', 'transition-direction-gap'];

function errorCount(attempt: AdaptationAttempt): number {
  const metrics = attempt.result.metrics;
  return metrics.missedNotes + metrics.extraStrums + metrics.brokenSustains;
}

function hasRequiredTechnicalData(attempt: AdaptationAttempt): boolean {
  const { config } = attempt.snapshot;
  const { metrics } = attempt.result;
  if (config.goals.requireArticulation
    && (metrics.articulationCompliance.status !== 'available' || metrics.articulationCompliance.value < 1)) return false;
  if (config.goals.requireStrumDirection
    && (metrics.strumDirectionCompliance.status !== 'available' || metrics.strumDirectionCompliance.value < 1)) return false;
  if (config.goals.requireFullSustains
    && (metrics.sustainCompletion.status !== 'available' || metrics.sustainCompletion.value < 1)) return false;
  return true;
}

function directionWasObserved(attempt: AdaptationAttempt): boolean {
  if (attempt.snapshot.config.technique !== 'alternate-strum') return true;
  return attempt.snapshot.device.capabilities.strum === 'directional'
    && attempt.result.metrics.strumDirectionCompliance.status === 'available';
}

function meetsGoals(attempt: AdaptationAttempt, policy: AdaptationPolicy): boolean {
  const { metrics } = attempt.result;
  return attempt.result.ending.state === 'completed'
    && attempt.result.progression.eligible
    && metrics.plannedNotes >= policy.minimumNotes
    && metrics.noteAccuracy.status === 'available'
    && metrics.noteAccuracy.value >= attempt.snapshot.config.goals.minimumAccuracy
    && errorCount(attempt) <= attempt.snapshot.config.goals.maximumErrors
    && directionWasObserved(attempt)
    && hasRequiredTechnicalData(attempt);
}

function comparable(left: AdaptationAttempt, right: AdaptationAttempt): boolean {
  const a = left.snapshot;
  const b = right.snapshot;
  const ac = a.config;
  const bc = b.config;
  return a.mode === b.mode
    && ac.technique === bc.technique && ac.level === bc.level
    && ac.pattern.id === bc.pattern.id && ac.pattern.version === bc.pattern.version
    && ac.bpm === bc.bpm && ac.subdivision === bc.subdivision
    && ac.allowedFrets === bc.allowedFrets && ac.patternLength === bc.patternLength
    && JSON.stringify(ac.length) === JSON.stringify(bc.length)
    && JSON.stringify(ac.manualPattern ?? null) === JSON.stringify(bc.manualPattern ?? null)
    && ac.articulation === bc.articulation && ac.automaticStrum === bc.automaticStrum
    && ac.chordSize === bc.chordSize && ac.sustainTicks === bc.sustainTicks
    && JSON.stringify(ac.strumDirectionGoal) === JSON.stringify(bc.strumDirectionGoal)
    && JSON.stringify(ac.goals) === JSON.stringify(bc.goals)
    && a.rules.id === b.rules.id && a.rules.version === b.rules.version
    && a.chart.generator.id === b.chart.generator.id && a.chart.generator.version === b.chart.generator.version;
}

function consecutiveAttempts(
  current: AdaptationAttempt,
  history: readonly AdaptationAttempt[],
  predicate: (attempt: AdaptationAttempt) => boolean,
): number {
  let count = predicate(current) ? 1 : 0;
  if (count === 0) return 0;
  const ordered = [...history]
    .filter((attempt) => attempt.result.sessionId !== current.result.sessionId)
    .sort((left, right) => right.result.endedAtIso.localeCompare(left.result.endedAtIso));
  for (const attempt of ordered) {
    if (!comparable(current, attempt)) continue;
    if (!predicate(attempt)) break;
    count += 1;
  }
  return count;
}

function diagnosticPriority(code: DiagnosticCode): number {
  const index = CORRECTIVE_DIAGNOSTIC_CODES.indexOf(code);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

function actionableDiagnostic(
  report: SessionAnalysisReport | null,
  policy: AdaptationPolicy,
): TrainingDiagnostic | null {
  if (!report) return null;
  return [...report.diagnostics]
    .filter(({ code, occurrences, sampleCount }) => CORRECTIVE_DIAGNOSTIC_CODES.includes(code)
      && occurrences >= policy.minimumDiagnosticOccurrences
      && sampleCount >= policy.minimumDiagnosticSamples)
    .sort((left, right) => diagnosticPriority(left.code) - diagnosticPriority(right.code)
      || right.occurrences - left.occurrences)[0] ?? null;
}

function recommendationObjective(code: DiagnosticCode): TrainingRecommendation['objective'] {
  if (code === 'wrong-strum-direction' || code === 'extra-input') return 'strum-direction';
  if (code === 'sustain-short') return 'sustain';
  if (code === 'timing-early-trend' || code === 'timing-late-trend') return 'timing';
  return 'accuracy';
}

function focusedTransitionConfig(attempt: AdaptationAttempt, diagnostic: TrainingDiagnostic): DrillConfig | null {
  const report = attempt.result.analysis;
  if (!report) return null;
  const buildPair = (first: ChartNote, second: ChartNote): DrillConfig | null => {
    if (first.durationTicks > 0 || second.durationTicks > 0) return null;
    const delta = second.tick - first.tick;
    if (delta <= 0) return null;
    try {
      return parseDrillConfig({
        ...attempt.snapshot.config,
        pattern: MANUAL_PATTERN_REFERENCE,
        patternLength: 2,
        sustainTicks: 0,
        goals: { ...attempt.snapshot.config.goals, requireFullSustains: false },
        manualPattern: {
          schemaVersion: 1,
          lengthTicks: delta * 2,
          steps: [
            { tick: 0, frets: first.frets, durationTicks: 0, articulation: first.articulation, segmentId: 'corrective-transition' },
            { tick: delta, frets: second.frets, durationTicks: 0, articulation: second.articulation, segmentId: 'corrective-transition' },
          ],
        },
      });
    } catch {
      return null;
    }
  };
  const notes = attempt.snapshot.chart.notes;
  const evidenceNoteIds = new Set(diagnostic.evidence.flatMap(({ noteIds }) => noteIds));
  for (let index = 0; index < notes.length - 1; index += 1) {
    const first = notes[index];
    const second = notes[index + 1];
    if (first && second && evidenceNoteIds.has(first.id) && evidenceNoteIds.has(second.id)) {
      const focused = buildPair(first, second);
      if (focused) return focused;
    }
  }
  const transitions = report.transitionAccuracy
    .filter((item) => item.accuracy.status === 'available')
    .sort((left, right) => {
      const leftValue = left.accuracy.status === 'available' ? left.accuracy.value : 1;
      const rightValue = right.accuracy.status === 'available' ? right.accuracy.value : 1;
      return leftValue - rightValue;
    });
  const transition = transitions[0];
  if (!transition) return null;
  for (let index = 0; index < notes.length - 1; index += 1) {
    const first = notes[index];
    const second = notes[index + 1];
    if (!first || !second || first.frets !== transition.from || second.frets !== transition.to) continue;
    const focused = buildPair(first, second);
    if (focused) return focused;
  }
  return null;
}

function evidenceOf(diagnostic: TrainingDiagnostic | null, sessionId: string): readonly EvidenceReference[] {
  return diagnostic?.evidence.length ? diagnostic.evidence
    : [{ sessionId, noteIds: [], inputSequences: [], judgmentSequences: [] }];
}

function makeRecommendation(
  attempt: AdaptationAttempt,
  policy: AdaptationPolicy,
  properties: Omit<TrainingRecommendation, 'schemaVersion' | 'id' | 'policy'>,
): AdaptationEvaluation {
  return {
    status: 'recommended',
    recommendation: immutableCopy({
      schemaVersion: 1,
      id: `${attempt.result.sessionId}:recommendation:${policy.reference.version}`,
      policy: policy.reference,
      ...properties,
    }),
  };
}

function adjacentLevel(level: DrillLevel, direction: -1 | 1): DrillLevel | null {
  return LEVELS[LEVELS.indexOf(level) + direction] ?? null;
}

export function evaluateAdaptation(
  current: AdaptationAttempt,
  history: readonly AdaptationAttempt[],
  policy: AdaptationPolicy = DEFAULT_ADAPTATION_POLICY,
): AdaptationEvaluation {
  const config = current.snapshot.config;
  const required = Math.max(config.goals.consistentAttempts, policy.minimumConsistentAttempts);
  if (!current.result.progression.eligible || current.result.ending.state !== 'completed') {
    return { status: 'not-recommended', reason: 'attempt-ineligible', observedAttempts: 0, requiredAttempts: required };
  }
  if (current.result.metrics.plannedNotes < policy.minimumNotes
    || current.result.metrics.noteAccuracy.status !== 'available') {
    return { status: 'not-recommended', reason: 'insufficient-samples', observedAttempts: 0, requiredAttempts: required };
  }
  if (!directionWasObserved(current)) {
    return { status: 'not-recommended', reason: 'direction-unobserved', observedAttempts: 0, requiredAttempts: required };
  }

  const diagnostic = actionableDiagnostic(current.result.analysis, policy);
  const descriptor = getTechniqueDescriptor(config.technique);
  if (!meetsGoals(current, policy)) {
    const failureStreak = consecutiveAttempts(current, history, (attempt) => !meetsGoals(attempt, policy));
    if (diagnostic && TRANSITION_CODES.includes(diagnostic.code)) {
      const focused = focusedTransitionConfig(current, diagnostic);
      if (focused) return makeRecommendation(current, policy, {
        objective: 'accuracy', reason: diagnostic.code, sampleCount: diagnostic.sampleCount,
        consistency: { observedAttempts: failureStreak, requiredAttempts: policy.minimumRegressionAttempts },
        diagnosticIds: [diagnostic.id], evidence: evidenceOf(diagnostic, current.result.sessionId),
        change: { kind: 'pattern', from: config.pattern, to: focused.pattern }, resultingConfig: focused,
      });
    }
    if (config.bpm > descriptor.parameters.bpm.minimum) {
      const reduced = Math.max(descriptor.parameters.bpm.minimum, config.bpm - policy.bpmReduction);
      const reason = diagnostic?.code ?? (errorCount(current) > config.goals.maximumErrors
        ? 'error-limit-exceeded' : 'accuracy-below-goal');
      return makeRecommendation(current, policy, {
        objective: diagnostic ? recommendationObjective(diagnostic.code) : 'accuracy',
        reason, sampleCount: diagnostic?.sampleCount ?? current.result.metrics.plannedNotes,
        consistency: { observedAttempts: failureStreak, requiredAttempts: policy.minimumRegressionAttempts },
        diagnosticIds: diagnostic ? [diagnostic.id] : [], evidence: evidenceOf(diagnostic, current.result.sessionId),
        change: { kind: 'bpm', from: config.bpm, to: reduced },
        resultingConfig: parseDrillConfig({ ...config, bpm: reduced }),
      });
    }
    if (failureStreak >= policy.minimumRegressionAttempts) {
      const previousLevel = adjacentLevel(config.level, -1);
      const preset = previousLevel ? DRILL_PRESETS.find((item) => item.technique === config.technique
        && item.level === previousLevel) : undefined;
      if (preset && previousLevel) return makeRecommendation(current, policy, {
        objective: diagnostic ? recommendationObjective(diagnostic.code) : 'accuracy',
        reason: diagnostic?.code ?? 'accuracy-below-goal',
        sampleCount: diagnostic?.sampleCount ?? current.result.metrics.plannedNotes,
        consistency: { observedAttempts: failureStreak, requiredAttempts: policy.minimumRegressionAttempts },
        diagnosticIds: diagnostic ? [diagnostic.id] : [], evidence: evidenceOf(diagnostic, current.result.sessionId),
        change: { kind: 'level', from: config.level, to: previousLevel },
        resultingConfig: parseDrillConfig({ ...preset.config, bpm: config.bpm, goals: config.goals }),
      });
    }
    return { status: 'not-recommended', reason: diagnostic ? 'no-actionable-evidence' : 'awaiting-consistency',
      observedAttempts: failureStreak, requiredAttempts: policy.minimumRegressionAttempts };
  }

  const successStreak = consecutiveAttempts(current, history, (attempt) => meetsGoals(attempt, policy));
  if (successStreak < required) {
    return { status: 'not-recommended', reason: 'awaiting-consistency', observedAttempts: successStreak, requiredAttempts: required };
  }
  if (config.bpm < descriptor.parameters.bpm.maximum) {
    const increased = Math.min(descriptor.parameters.bpm.maximum, config.bpm + policy.bpmIncrease);
    return makeRecommendation(current, policy, {
      objective: 'accuracy', reason: 'goals-consistently-met', sampleCount: current.result.metrics.plannedNotes,
      consistency: { observedAttempts: successStreak, requiredAttempts: required }, diagnosticIds: [],
      evidence: evidenceOf(null, current.result.sessionId),
      change: { kind: 'bpm', from: config.bpm, to: increased },
      resultingConfig: parseDrillConfig({ ...config, bpm: increased }),
    });
  }
  const nextLevel = adjacentLevel(config.level, 1);
  const preset = nextLevel ? DRILL_PRESETS.find((item) => item.technique === config.technique
    && item.level === nextLevel) : undefined;
  if (preset && nextLevel) return makeRecommendation(current, policy, {
    objective: 'accuracy', reason: 'goals-consistently-met', sampleCount: current.result.metrics.plannedNotes,
    consistency: { observedAttempts: successStreak, requiredAttempts: required }, diagnosticIds: [],
    evidence: evidenceOf(null, current.result.sessionId),
    change: { kind: 'level', from: config.level, to: nextLevel },
    resultingConfig: parseDrillConfig({ ...preset.config, goals: config.goals }),
  });
  return { status: 'not-recommended', reason: 'catalog-limit', observedAttempts: successStreak, requiredAttempts: required };
}
