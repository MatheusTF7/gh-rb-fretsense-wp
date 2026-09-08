import type {
  Chart,
  DrillLevel,
  JudgmentEvent,
  NormalizedInputEvent,
  SessionMode,
  SessionResult,
  SessionSnapshot,
  Technique,
  VersionedReference,
} from '@/engine/domain';
import {
  immutableCopy, readArray, readBoolean, readChoice, readInteger, readIsoDate, readNumber,
  readRecord, readReference, readString, requireCondition, requireSameData,
} from '@/engine/domain';
import { createSessionSnapshot } from '@/engine/session';

/** Versão dos registros de sessão; não muda quando um novo object store é adicionado. */
export const SESSION_DATABASE_SCHEMA_VERSION = 1;
/** Versão física do IndexedDB, atualmente com sessões, resumos e recomendações. */
export const SESSION_DATABASE_VERSION = 2;
export const SESSION_EXPORT_SCHEMA_VERSION = 1;
export const SESSION_RAW_RETENTION = Object.freeze({
  maximumInputs: 2_048,
  maximumJudgments: 2_048,
  maximumSerializedBytes: 2_000_000,
});

export type SessionStorageIssue =
  | 'unavailable'
  | 'quota-exceeded'
  | 'migration-failed'
  | 'write-failed'
  | 'id-conflict'
  | 'incompatible-records';

export interface SessionStorageState {
  readonly mode: 'persistent' | 'memory';
  readonly issue: SessionStorageIssue | null;
}

export interface RetainedSessionEvents {
  readonly status: 'complete' | 'summary-only';
  readonly reason: 'source-incomplete' | 'retention-limit' | null;
  readonly inputCount: number;
  readonly judgmentCount: number;
  readonly inputs: readonly NormalizedInputEvent[];
  readonly judgments: readonly JudgmentEvent[];
}

export interface StoredSessionRecord {
  readonly schemaVersion: typeof SESSION_DATABASE_SCHEMA_VERSION;
  readonly id: string;
  readonly savedAtIso: string;
  readonly snapshot: SessionSnapshot;
  readonly result: SessionResult;
  /** Perfis ainda não implementados são registrados como ausentes, nunca inferidos. */
  readonly presentation: VersionedReference | null;
  readonly gameEdition: VersionedReference | null;
  readonly retainedEvents: RetainedSessionEvents;
}

export interface SessionSummary {
  readonly schemaVersion: typeof SESSION_DATABASE_SCHEMA_VERSION;
  readonly id: string;
  readonly createdAtIso: string;
  readonly endedAtIso: string;
  readonly mode: SessionMode;
  readonly endingState: SessionResult['ending']['state'];
  readonly technique: Technique;
  readonly level: DrillLevel;
  readonly bpm: number;
  readonly hitNotes: number;
  readonly plannedNotes: number;
  readonly accuracy: number | null;
  readonly detailedExecutionAvailable: boolean;
}

export interface SessionListFilters {
  readonly mode?: SessionMode;
  readonly endingState?: SessionResult['ending']['state'];
  readonly technique?: Technique;
  readonly level?: DrillLevel;
  readonly endedAtOrAfterIso?: string;
  readonly endedBeforeIso?: string;
}

export interface SessionListRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly filters: SessionListFilters;
}

export interface SessionListPage {
  readonly records: readonly SessionSummary[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly incompatibleCount: number;
}

export interface SessionExportV1 {
  readonly schemaVersion: typeof SESSION_EXPORT_SCHEMA_VERSION;
  readonly product: 'fretsense';
  readonly exportedAtIso: string;
  readonly session: StoredSessionRecord;
}

export interface SessionRepository {
  readonly state: SessionStorageState;
  save(record: StoredSessionRecord): Promise<SessionStorageState>;
  get(id: string): Promise<StoredSessionRecord | null>;
  list(request: SessionListRequest): Promise<SessionListPage>;
  remove(id: string): Promise<boolean>;
  retry(): Promise<SessionStorageState>;
}

function serializedSize(value: unknown): number {
  const text = JSON.stringify(value);
  return typeof TextEncoder === 'undefined' ? text.length * 2 : new TextEncoder().encode(text).length;
}

export function createStoredSessionRecord(
  snapshot: SessionSnapshot,
  result: SessionResult,
  inputs: readonly NormalizedInputEvent[],
  judgments: readonly JudgmentEvent[],
  savedAtIso: string = result.endedAtIso,
): StoredSessionRecord {
  requireCondition(snapshot.id === result.sessionId, 'session.id', 'Result belongs to another session.');
  const sourceComplete = result.availability.inputs === 'complete' && result.availability.judgments === 'complete';
  const withinCountLimit = inputs.length <= SESSION_RAW_RETENTION.maximumInputs
    && judgments.length <= SESSION_RAW_RETENTION.maximumJudgments;
  const withinSizeLimit = withinCountLimit
    && serializedSize({ inputs, judgments }) <= SESSION_RAW_RETENTION.maximumSerializedBytes;
  const keepEvents = sourceComplete && withinSizeLimit;
  let retainedEvents: RetainedSessionEvents;
  try {
    retainedEvents = immutableCopy({
      status: keepEvents ? 'complete' as const : 'summary-only' as const,
      reason: keepEvents ? null : sourceComplete ? 'retention-limit' as const : 'source-incomplete' as const,
      inputCount: inputs.length,
      judgmentCount: judgments.length,
      inputs: keepEvents ? inputs : [],
      judgments: keepEvents ? judgments : [],
    });
  } catch (error) {
    if (!keepEvents) throw error;
    retainedEvents = immutableCopy({
      status: 'summary-only' as const,
      reason: 'retention-limit' as const,
      inputCount: inputs.length,
      judgmentCount: judgments.length,
      inputs: [],
      judgments: [],
    });
  }
  return Object.freeze({
    schemaVersion: SESSION_DATABASE_SCHEMA_VERSION,
    id: snapshot.id,
    savedAtIso: readIsoDate(savedAtIso, 'session.savedAtIso'),
    snapshot: immutableCopy(snapshot),
    result: immutableCopy(result),
    presentation: null,
    gameEdition: null,
    retainedEvents,
  });
}

export function summarizeSession(record: StoredSessionRecord): SessionSummary {
  const accuracy = record.result.metrics.noteAccuracy;
  return immutableCopy({
    schemaVersion: SESSION_DATABASE_SCHEMA_VERSION,
    id: record.id,
    createdAtIso: record.snapshot.createdAtIso,
    endedAtIso: record.result.endedAtIso,
    mode: record.snapshot.mode,
    endingState: record.result.ending.state,
    technique: record.snapshot.config.technique,
    level: record.snapshot.config.level,
    bpm: record.snapshot.config.bpm,
    hitNotes: record.result.metrics.hitNotes,
    plannedNotes: record.result.metrics.plannedNotes,
    accuracy: accuracy.status === 'available' ? accuracy.value : null,
    detailedExecutionAvailable: record.retainedEvents.status === 'complete',
  });
}

/** Valida o envelope persistido. Versões incompatíveis permanecem no banco e não são apagadas. */
export function parseStoredSessionRecord(value: unknown): StoredSessionRecord {
  const record = readRecord(value, 'storedSession');
  readChoice(record.schemaVersion, [SESSION_DATABASE_SCHEMA_VERSION], 'storedSession.schemaVersion');
  const id = readString(record.id, 'storedSession.id');
  const savedAtIso = readIsoDate(record.savedAtIso, 'storedSession.savedAtIso');
  const snapshot = readRecord(record.snapshot, 'storedSession.snapshot');
  const result = readRecord(record.result, 'storedSession.result');
  readChoice(snapshot.schemaVersion, [1], 'storedSession.snapshot.schemaVersion');
  readChoice(result.schemaVersion, [1], 'storedSession.result.schemaVersion');
  requireCondition(snapshot.id === id && result.sessionId === id, 'storedSession.id', 'Stored session IDs do not match.');
  const createdAtIso = readIsoDate(snapshot.createdAtIso, 'storedSession.snapshot.createdAtIso');
  const endedAtIso = readIsoDate(result.endedAtIso, 'storedSession.result.endedAtIso');
  const mode = readChoice(snapshot.mode, ['practice', 'assessment'], 'storedSession.snapshot.mode');
  const config = readRecord(snapshot.config, 'storedSession.snapshot.config');
  readChoice(config.technique, ['single-strum', 'alternate-strum', 'hopo', 'tapping', 'sequences', 'chords', 'sustains', 'mixed'], 'storedSession.snapshot.config.technique');
  readChoice(config.level, ['beginner', 'intermediate', 'advanced'], 'storedSession.snapshot.config.level');
  const ending = readRecord(result.ending, 'storedSession.result.ending');
  readChoice(ending.state, ['completed', 'aborted'], 'storedSession.result.ending.state');
  const parsedSnapshot = createSessionSnapshot(record.snapshot as SessionSnapshot, { id, createdAtIso }, snapshot.chart as Chart);
  requireCondition(parsedSnapshot.mode === mode, 'storedSession.snapshot.mode', 'Stored mode changed while parsing.');
  requireSameData(snapshot.rules, parsedSnapshot.rules, 'storedSession.snapshot.rules');
  readNumber(result.activeDurationMs, 'storedSession.result.activeDurationMs', 0, Number.MAX_SAFE_INTEGER);
  readArray(result.interruptions, 'storedSession.result.interruptions', 64);
  const metrics = readRecord(result.metrics, 'storedSession.result.metrics');
  const plannedNotes = readInteger(metrics.plannedNotes, 'storedSession.result.metrics.plannedNotes', 0, 4096);
  const hitNotes = readInteger(metrics.hitNotes, 'storedSession.result.metrics.hitNotes', 0, plannedNotes);
  const missedNotes = readInteger(metrics.missedNotes, 'storedSession.result.metrics.missedNotes', 0, plannedNotes);
  const unjudgedNotes = readInteger(metrics.unjudgedNotes, 'storedSession.result.metrics.unjudgedNotes', 0, plannedNotes);
  requireCondition(plannedNotes === parsedSnapshot.chart.notes.length, 'storedSession.result.metrics.plannedNotes', 'Metric count differs from the chart.');
  requireCondition(hitNotes + missedNotes + unjudgedNotes === plannedNotes, 'storedSession.result.metrics', 'Metric counts are inconsistent.');
  readInteger(metrics.extraStrums, 'storedSession.result.metrics.extraStrums', 0, 65_536);
  readInteger(metrics.brokenSustains, 'storedSession.result.metrics.brokenSustains', 0, hitNotes);
  const bestCombo = readInteger(metrics.bestCombo, 'storedSession.result.metrics.bestCombo', 0, hitNotes);
  readInteger(metrics.finalCombo, 'storedSession.result.metrics.finalCombo', 0, bestCombo);
  for (const key of ['noteAccuracy', 'articulationCompliance', 'strumDirectionCompliance', 'sustainCompletion'] as const) {
    const metric = readRecord(metrics[key], `storedSession.result.metrics.${key}`);
    const metricStatus = readChoice(metric.status, ['available', 'unavailable'], `storedSession.result.metrics.${key}.status`);
    if (metricStatus === 'available') readNumber(metric.value, `storedSession.result.metrics.${key}.value`, 0, 1);
  }
  const timing = readRecord(metrics.timing, 'storedSession.result.metrics.timing');
  const timingStatus = readChoice(timing.status, ['available', 'unavailable'], 'storedSession.result.metrics.timing.status');
  if (timingStatus === 'available') readNumber(timing.meanErrorMs, 'storedSession.result.metrics.timing.meanErrorMs', -1000, 1000);
  const availability = readRecord(result.availability, 'storedSession.result.availability');
  readChoice(availability.inputs, ['complete', 'partial', 'not-recorded', 'discarded'], 'storedSession.result.availability.inputs');
  readChoice(availability.judgments, ['complete', 'partial', 'not-recorded', 'discarded'], 'storedSession.result.availability.judgments');
  readChoice(availability.analysis, ['complete', 'partial', 'not-performed'], 'storedSession.result.availability.analysis');
  const progression = readRecord(result.progression, 'storedSession.result.progression');
  readBoolean(progression.eligible, 'storedSession.result.progression.eligible');
  if (result.analysis !== null) {
    const analysis = readRecord(result.analysis, 'storedSession.result.analysis');
    readChoice(analysis.schemaVersion, [1], 'storedSession.result.analysis.schemaVersion');
    readArray(analysis.fretAccuracy, 'storedSession.result.analysis.fretAccuracy', 5);
    readArray(analysis.transitionAccuracy, 'storedSession.result.analysis.transitionAccuracy', 4096);
    readArray(analysis.strumDirection, 'storedSession.result.analysis.strumDirection', 2);
    readArray(analysis.techniques, 'storedSession.result.analysis.techniques', 8);
    readArray(analysis.segments, 'storedSession.result.analysis.segments', 512);
    readArray(analysis.diagnostics, 'storedSession.result.analysis.diagnostics', 64);
  }
  const retained = readRecord(record.retainedEvents, 'storedSession.retainedEvents');
  const status = readChoice(retained.status, ['complete', 'summary-only'], 'storedSession.retainedEvents.status');
  const inputs = readArray(retained.inputs, 'storedSession.retainedEvents.inputs', SESSION_RAW_RETENTION.maximumInputs);
  const judgments = readArray(retained.judgments, 'storedSession.retainedEvents.judgments', SESSION_RAW_RETENTION.maximumJudgments);
  readInteger(retained.inputCount, 'storedSession.retainedEvents.inputCount', inputs.length, 65_536);
  readInteger(retained.judgmentCount, 'storedSession.retainedEvents.judgmentCount', judgments.length, 131_072);
  requireCondition(status === 'complete' ? retained.reason === null : ['source-incomplete', 'retention-limit'].includes(String(retained.reason)),
    'storedSession.retainedEvents.reason', 'Retention reason does not match its status.');
  requireCondition(status === 'summary-only' || (retained.inputCount === inputs.length && retained.judgmentCount === judgments.length),
    'storedSession.retainedEvents', 'Complete event counts do not match retained data.');
  requireCondition(status === 'complete' || (inputs.length === 0 && judgments.length === 0),
    'storedSession.retainedEvents', 'Summary-only records cannot contain raw events.');
  requireCondition(status === 'summary-only'
    || (availability.inputs === 'complete' && availability.judgments === 'complete'),
    'storedSession.retainedEvents', 'Complete retained events require complete source records.');
  requireCondition(serializedSize({ inputs, judgments }) <= SESSION_RAW_RETENTION.maximumSerializedBytes,
    'storedSession.retainedEvents', 'Retained events exceed the serialized size limit.');
  const presentation = record.presentation === null ? null
    : immutableCopy(readReference(record.presentation, 'storedSession.presentation'));
  const gameEdition = record.gameEdition === null ? null
    : immutableCopy(readReference(record.gameEdition, 'storedSession.gameEdition'));
  const parsedResult = immutableCopy({ ...result, endedAtIso }) as unknown as SessionResult;
  const parsedRetainedEvents = immutableCopy({
    status,
    reason: retained.reason as RetainedSessionEvents['reason'],
    inputCount: retained.inputCount as number,
    judgmentCount: retained.judgmentCount as number,
    inputs: inputs as unknown as readonly NormalizedInputEvent[],
    judgments: judgments as unknown as readonly JudgmentEvent[],
  });
  return Object.freeze({
    schemaVersion: SESSION_DATABASE_SCHEMA_VERSION,
    id,
    savedAtIso,
    snapshot: parsedSnapshot,
    result: parsedResult,
    presentation,
    gameEdition,
    retainedEvents: parsedRetainedEvents,
  });
}

export function parseSessionSummary(value: unknown): SessionSummary {
  const summary = readRecord(value, 'sessionSummary');
  readChoice(summary.schemaVersion, [SESSION_DATABASE_SCHEMA_VERSION], 'sessionSummary.schemaVersion');
  const accuracy = summary.accuracy === null ? null : readNumber(summary.accuracy, 'sessionSummary.accuracy', 0, 1);
  const plannedNotes = readInteger(summary.plannedNotes, 'sessionSummary.plannedNotes', 0, 4096);
  const hitNotes = readInteger(summary.hitNotes, 'sessionSummary.hitNotes', 0, plannedNotes);
  return immutableCopy({
    schemaVersion: SESSION_DATABASE_SCHEMA_VERSION,
    id: readString(summary.id, 'sessionSummary.id'),
    createdAtIso: readIsoDate(summary.createdAtIso, 'sessionSummary.createdAtIso'),
    endedAtIso: readIsoDate(summary.endedAtIso, 'sessionSummary.endedAtIso'),
    mode: readChoice(summary.mode, ['practice', 'assessment'], 'sessionSummary.mode'),
    endingState: readChoice(summary.endingState, ['completed', 'aborted'], 'sessionSummary.endingState'),
    technique: readChoice(summary.technique, ['single-strum', 'alternate-strum', 'hopo', 'tapping', 'sequences', 'chords', 'sustains', 'mixed'], 'sessionSummary.technique'),
    level: readChoice(summary.level, ['beginner', 'intermediate', 'advanced'], 'sessionSummary.level'),
    bpm: readInteger(summary.bpm, 'sessionSummary.bpm', 40, 300),
    hitNotes,
    plannedNotes,
    accuracy,
    detailedExecutionAvailable: readBoolean(summary.detailedExecutionAvailable, 'sessionSummary.detailedExecutionAvailable'),
  });
}

export function createSessionExport(record: StoredSessionRecord, exportedAtIso: string = new Date().toISOString()): SessionExportV1 {
  return immutableCopy({
    schemaVersion: SESSION_EXPORT_SCHEMA_VERSION,
    product: 'fretsense',
    exportedAtIso: readIsoDate(exportedAtIso, 'export.exportedAtIso'),
    session: record,
  });
}
