import type {
  DrillLevel,
  FretMask,
  JudgmentEvent,
  SessionMode,
  SessionResult,
  SessionSnapshot,
  Technique,
  VersionedReference,
} from '../domain';

export const REPORTING_POLICY = Object.freeze({
  id: 'fretsense-reporting',
  version: '1.0.0',
  minimumEvolutionAttempts: 3,
  minimumNotesPerAttempt: 8,
  maximumPatternErrorRows: 128,
} as const);

export interface ReportingAttempt {
  readonly snapshot: SessionSnapshot;
  readonly result: SessionResult;
  readonly presentation: VersionedReference | null;
  readonly gameEdition: VersionedReference | null;
  readonly judgments: readonly JudgmentEvent[] | null;
}

export type TimingDistributionBinId = 'very-early' | 'early' | 'centered' | 'late' | 'very-late';

export interface TimingDistributionBin {
  readonly id: TimingDistributionBinId;
  readonly minimumMs: number;
  readonly maximumMs: number;
  readonly count: number;
  readonly ratio: number;
}

export type TimingDistribution =
  | {
      readonly status: 'available';
      readonly sampleCount: number;
      readonly bins: readonly TimingDistributionBin[];
    }
  | { readonly status: 'unavailable'; readonly reason: 'raw-events-unavailable' | 'no-samples' };

export interface PatternErrorRow {
  readonly noteId: string;
  readonly tick: number;
  readonly positionRatio: number;
  readonly segmentId: string;
  readonly expectedFrets: FretMask;
  readonly diagnosticCodes: readonly string[];
}

export type PatternErrorMap =
  | {
      readonly status: 'available';
      readonly rows: readonly PatternErrorRow[];
      readonly referencedNotes: number;
      readonly omittedRows: number;
    }
  | { readonly status: 'unavailable'; readonly reason: 'analysis-not-performed' };

export interface SessionExecutionDetails {
  readonly policy: typeof REPORTING_POLICY;
  readonly timingDistribution: TimingDistribution;
  readonly patternErrors: PatternErrorMap;
}

export type SessionConditionDifference =
  | 'mode'
  | 'technique'
  | 'level'
  | 'bpm'
  | 'chart'
  | 'rule'
  | 'hit-window'
  | 'presentation'
  | 'game-edition'
  | 'device'
  | 'calibration';

export type SessionComparison =
  | { readonly status: 'none' }
  | {
      readonly status: 'incompatible';
      readonly candidateSessionId: string;
      readonly candidateEndedAtIso: string;
      readonly differences: readonly SessionConditionDifference[];
    }
  | {
      readonly status: 'compatible';
      readonly candidateSessionId: string;
      readonly candidateEndedAtIso: string;
      readonly accuracyDelta: number | null;
      readonly timingAbsoluteDeltaMs: number | null;
    };

export interface EvolutionPoint {
  readonly sessionId: string;
  readonly endedAtIso: string;
  readonly bpm: number;
  readonly chartId: string;
  readonly accuracy: number | null;
  readonly eligible: boolean;
  readonly sampleSufficient: boolean;
  readonly meetsGoals: boolean;
}

export type DemonstratedBpm =
  | { readonly status: 'available'; readonly value: number; readonly supportingAttempts: number }
  | {
      readonly status: 'unavailable';
      readonly reason: 'insufficient-samples' | 'no-consistent-bpm';
      readonly observedAttempts: number;
    };

export interface EvolutionCalibrationCondition {
  readonly method: SessionSnapshot['calibration']['method'];
  readonly judgmentOffsetMs: number;
  readonly visualOffsetMs: number;
  readonly audioMode: SessionSnapshot['calibration']['context']['audioMode'];
}

export interface EvolutionGroup {
  readonly id: string;
  readonly technique: Technique;
  readonly level: DrillLevel;
  readonly mode: SessionMode;
  readonly pattern: VersionedReference;
  readonly rule: VersionedReference;
  readonly hitWindow: { readonly earlyMs: number; readonly lateMs: number };
  readonly presentation: VersionedReference | null;
  readonly gameEdition: VersionedReference | null;
  readonly calibration: EvolutionCalibrationCondition;
  readonly device: VersionedReference;
  readonly attemptCount: number;
  readonly eligibleAttemptCount: number;
  readonly distinctChartCount: number;
  readonly minimumObservedBpm: number;
  readonly maximumObservedBpm: number;
  readonly demonstratedBpm: DemonstratedBpm;
  readonly points: readonly EvolutionPoint[];
}

export interface EvolutionDashboard {
  readonly policy: typeof REPORTING_POLICY;
  readonly attemptCount: number;
  readonly groups: readonly EvolutionGroup[];
}
