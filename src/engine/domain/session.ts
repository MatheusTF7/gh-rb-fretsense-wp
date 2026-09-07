import type { SessionMetrics, TrainingDiagnostic } from './analysis';
import type { DrillConfig } from './drill';
import type { CalibrationProfile, DeviceProfile } from './input';
import type { Chart, Milliseconds } from './music';
import type { RuleProfile } from './rules';

export type SessionMode = 'practice' | 'assessment';
export type SessionState =
  | 'idle'
  | 'ready'
  | 'countdown'
  | 'running'
  | 'paused'
  | 'completed'
  | 'aborted';

export interface SessionSnapshot {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly createdAtIso: string;
  readonly mode: SessionMode;
  readonly config: DrillConfig;
  readonly chart: Chart;
  readonly rules: RuleProfile;
  readonly device: DeviceProfile;
  readonly calibration: CalibrationProfile;
}

export type InterruptionReason =
  | 'user-pause'
  | 'focus-lost'
  | 'page-hidden'
  | 'device-disconnected'
  | 'audio-suspended'
  | 'input-timing-invalid';

export interface SessionInterruption {
  readonly reason: InterruptionReason;
  /** Tempo ativo bruto congelado; não avança durante a interrupção. */
  readonly sessionTimeMs: Milliseconds;
  /** Datas civis são metadados; nunca são usadas para julgar notas. */
  readonly startedAtIso: string;
  readonly resumedAtIso: string | null;
}

export type SessionEnding =
  | { readonly state: 'completed' }
  | {
      readonly state: 'aborted';
      readonly reason:
        | 'user-exit' | 'restart' | 'context-changed' | 'unrecoverable-error'
        | 'resource-limit' | 'evaluation-timeout';
    };

export type ProgressionEligibility =
  | { readonly eligible: true }
  | {
      readonly eligible: false;
      readonly reasons: readonly (
        | 'attempt-aborted'
        | 'attempt-interrupted'
        | 'required-data-unavailable'
      )[];
    };

export type RecordAvailability = 'complete' | 'partial' | 'not-recorded' | 'discarded';

export interface SessionResult {
  readonly schemaVersion: 1;
  readonly sessionId: string;
  readonly ending: SessionEnding;
  readonly endedAtIso: string;
  readonly activeDurationMs: Milliseconds;
  readonly interruptions: readonly SessionInterruption[];
  readonly metrics: SessionMetrics;
  readonly diagnostics: readonly TrainingDiagnostic[];
  readonly availability: {
    readonly inputs: RecordAvailability;
    readonly judgments: RecordAvailability;
    readonly analysis: 'complete' | 'partial' | 'not-performed';
  };
  /** Elegibilidade não implica promoção: metas e consistência são avaliadas depois. */
  readonly progression: ProgressionEligibility;
}
