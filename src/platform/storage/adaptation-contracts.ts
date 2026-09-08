import type { DrillConfig, TrainingRecommendation } from '@/engine/domain';
import {
  immutableCopy, parseDrillConfig, readArray, readChoice, readInteger, readIsoDate, readNumber,
  readRecord, readReference, readString, requireCondition, sameReference,
} from '@/engine/domain';

export const ADAPTATION_RECORD_SCHEMA_VERSION = 1;

export type RecommendationDecision = 'pending' | 'adjusting' | 'accepted' | 'ignored' | 'adjusted';

export interface StoredAdaptationRecord {
  readonly schemaVersion: typeof ADAPTATION_RECORD_SCHEMA_VERSION;
  readonly id: string;
  readonly sourceSessionId: string;
  readonly createdAtIso: string;
  readonly decidedAtIso: string | null;
  readonly decision: RecommendationDecision;
  readonly recommendation: TrainingRecommendation;
  /** Configuração efetivamente escolhida; nunca altera o snapshot da sessão de origem. */
  readonly resultingConfig: DrillConfig | null;
}

export interface AdaptationRepository {
  saveAdaptation(record: StoredAdaptationRecord): Promise<boolean>;
  getAdaptation(id: string): Promise<StoredAdaptationRecord | null>;
  getAdaptationForSession(sessionId: string): Promise<StoredAdaptationRecord | null>;
}

export function createStoredAdaptationRecord(
  sourceSessionId: string,
  recommendation: TrainingRecommendation,
  createdAtIso: string = new Date().toISOString(),
): StoredAdaptationRecord {
  requireCondition(recommendation.id.startsWith(`${sourceSessionId}:`), 'adaptation.recommendation.id',
    'Recommendation ID must identify its source session.');
  return immutableCopy({
    schemaVersion: ADAPTATION_RECORD_SCHEMA_VERSION,
    id: recommendation.id,
    sourceSessionId,
    createdAtIso,
    decidedAtIso: null,
    decision: 'pending',
    recommendation,
    resultingConfig: null,
  });
}

export function decideStoredAdaptation(
  record: StoredAdaptationRecord,
  decision: Exclude<RecommendationDecision, 'pending'>,
  resultingConfig: DrillConfig | null,
  decidedAtIso: string | null = decision === 'adjusting' ? null : new Date().toISOString(),
): StoredAdaptationRecord {
  requireCondition(record.decision === 'pending' || record.decision === 'adjusting', 'adaptation.decision',
    'A final recommendation decision cannot be changed.');
  requireCondition(decision === 'ignored' ? resultingConfig === null : resultingConfig !== null,
    'adaptation.resultingConfig', 'This decision has an invalid resulting configuration.');
  return immutableCopy({
    ...record,
    decision,
    decidedAtIso,
    resultingConfig: resultingConfig === null ? null : parseDrillConfig(resultingConfig),
  });
}

export function parseStoredAdaptationRecord(value: unknown): StoredAdaptationRecord {
  const record = readRecord(value, 'adaptation');
  const id = readString(record.id, 'adaptation.id');
  const sourceSessionId = readString(record.sourceSessionId, 'adaptation.sourceSessionId');
  requireCondition(id.startsWith(`${sourceSessionId}:`), 'adaptation.id', 'Recommendation does not match its source session.');
  const rawRecommendation = readRecord(record.recommendation, 'adaptation.recommendation');
  requireCondition(rawRecommendation.id === id && rawRecommendation.schemaVersion === 1,
    'adaptation.recommendation', 'Stored recommendation identity is invalid.');
  const consistency = readRecord(rawRecommendation.consistency, 'adaptation.recommendation.consistency');
  const change = readRecord(rawRecommendation.change, 'adaptation.recommendation.change');
  const changeKind = readChoice(change.kind, ['bpm', 'level', 'pattern'], 'adaptation.recommendation.change.kind');
  const parsedChange = changeKind === 'bpm' ? {
    kind: changeKind,
    from: readNumber(change.from, 'adaptation.recommendation.change.from', 40, 300),
    to: readNumber(change.to, 'adaptation.recommendation.change.to', 40, 300),
  } as const : changeKind === 'level' ? {
    kind: changeKind,
    from: readChoice(change.from, ['beginner', 'intermediate', 'advanced'], 'adaptation.recommendation.change.from'),
    to: readChoice(change.to, ['beginner', 'intermediate', 'advanced'], 'adaptation.recommendation.change.to'),
  } as const : {
    kind: changeKind,
    from: readReference(change.from, 'adaptation.recommendation.change.from'),
    to: readReference(change.to, 'adaptation.recommendation.change.to'),
  } as const;
  const recommendationConfig = parseDrillConfig(rawRecommendation.resultingConfig);
  requireCondition(parsedChange.kind !== 'bpm' || recommendationConfig.bpm === parsedChange.to,
    'adaptation.recommendation.change', 'BPM change does not match the resulting configuration.');
  requireCondition(parsedChange.kind !== 'level' || recommendationConfig.level === parsedChange.to,
    'adaptation.recommendation.change', 'Level change does not match the resulting configuration.');
  requireCondition(parsedChange.kind !== 'pattern' || sameReference(recommendationConfig.pattern, parsedChange.to),
    'adaptation.recommendation.change', 'Pattern change does not match the resulting configuration.');
  const recommendation: TrainingRecommendation = immutableCopy({
    schemaVersion: 1,
    id,
    policy: readReference(rawRecommendation.policy, 'adaptation.recommendation.policy'),
    objective: readChoice(rawRecommendation.objective,
      ['timing', 'accuracy', 'articulation', 'strum-direction', 'sustain'], 'adaptation.recommendation.objective'),
    reason: readChoice(rawRecommendation.reason, [
      'omission', 'extra-input', 'fret-substitution', 'sequence-inversion', 'chord-incomplete',
      'chord-extra-frets', 'chord-substitution', 'sustain-short', 'wrong-strum-direction',
      'tap-strummed', 'hopo-strummed', 'timing-early-trend', 'timing-late-trend',
      'transition-direction-gap', 'accuracy-below-goal', 'error-limit-exceeded', 'goals-consistently-met',
    ], 'adaptation.recommendation.reason'),
    sampleCount: readInteger(rawRecommendation.sampleCount, 'adaptation.recommendation.sampleCount', 0, 131_072),
    consistency: {
      observedAttempts: readInteger(consistency.observedAttempts,
        'adaptation.recommendation.consistency.observedAttempts', 0, 512),
      requiredAttempts: readInteger(consistency.requiredAttempts,
        'adaptation.recommendation.consistency.requiredAttempts', 1, 128),
    },
    diagnosticIds: readArray(rawRecommendation.diagnosticIds, 'adaptation.recommendation.diagnosticIds', 64)
      .map((item, index) => readString(item, `adaptation.recommendation.diagnosticIds[${index}]`)),
    evidence: readArray(rawRecommendation.evidence, 'adaptation.recommendation.evidence', 64).map((item, index) => {
      const evidence = readRecord(item, `adaptation.recommendation.evidence[${index}]`);
      const evidenceSessionId = readString(evidence.sessionId, `adaptation.recommendation.evidence[${index}].sessionId`);
      requireCondition(evidenceSessionId === sourceSessionId,
        `adaptation.recommendation.evidence[${index}].sessionId`, 'Evidence belongs to another session.');
      return {
        sessionId: evidenceSessionId,
        noteIds: readArray(evidence.noteIds, `adaptation.recommendation.evidence[${index}].noteIds`, 4096)
          .map((entry, entryIndex) => readString(entry, `adaptation.recommendation.evidence[${index}].noteIds[${entryIndex}]`)),
        inputSequences: readArray(evidence.inputSequences, `adaptation.recommendation.evidence[${index}].inputSequences`, 4096)
          .map((entry, entryIndex) => readInteger(entry, `adaptation.recommendation.evidence[${index}].inputSequences[${entryIndex}]`, 0, 131_072)),
        judgmentSequences: readArray(evidence.judgmentSequences, `adaptation.recommendation.evidence[${index}].judgmentSequences`, 4096)
          .map((entry, entryIndex) => readInteger(entry, `adaptation.recommendation.evidence[${index}].judgmentSequences[${entryIndex}]`, 0, 131_072)),
      };
    }),
    change: parsedChange,
    resultingConfig: recommendationConfig,
  });
  const decision = readChoice(record.decision, ['pending', 'adjusting', 'accepted', 'ignored', 'adjusted'], 'adaptation.decision');
  const resultingConfig = record.resultingConfig === null ? null : parseDrillConfig(record.resultingConfig);
  requireCondition(decision === 'pending' || decision === 'ignored' ? resultingConfig === null : resultingConfig !== null,
    'adaptation.resultingConfig', 'Stored decision has an invalid resulting configuration.');
  const decidedAtIso = record.decidedAtIso === null ? null : readIsoDate(record.decidedAtIso, 'adaptation.decidedAtIso');
  requireCondition(['pending', 'adjusting'].includes(decision) ? decidedAtIso === null : decidedAtIso !== null,
    'adaptation.decidedAtIso', 'Decision timestamp does not match its state.');
  return immutableCopy({
    schemaVersion: readChoice(record.schemaVersion, [ADAPTATION_RECORD_SCHEMA_VERSION], 'adaptation.schemaVersion'),
    id,
    sourceSessionId,
    createdAtIso: readIsoDate(record.createdAtIso, 'adaptation.createdAtIso'),
    decidedAtIso,
    decision,
    recommendation,
    resultingConfig,
  });
}
