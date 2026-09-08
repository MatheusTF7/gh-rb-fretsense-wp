import type { DrillConfig } from './drill';
import type {
  DrillLevel,
  Fret,
  Milliseconds,
  NoteFrets,
  StrumDirection,
  Technique,
  VersionedReference,
} from './music';

export type MetricUnavailableReason =
  | 'no-samples'
  | 'insufficient-data'
  | 'unsupported-capability'
  | 'not-applicable';

export interface UnavailableMetric {
  readonly status: 'unavailable';
  readonly reason: MetricUnavailableReason;
}

export type RatioMetric =
  | {
      readonly status: 'available';
      readonly unit: 'ratio';
      readonly numerator: number;
      readonly denominator: number;
      /** Razão em [0, 1]. Um acorde conta uma vez nas métricas de nota. */
      readonly value: number;
    }
  | UnavailableMetric;

export type TimingMetrics =
  | {
      readonly status: 'available';
      readonly unit: 'milliseconds';
      readonly sampleCount: number;
      readonly meanErrorMs: Milliseconds;
      readonly meanAbsoluteErrorMs: Milliseconds;
      readonly populationStdDevMs: Milliseconds;
    }
  | UnavailableMetric;

export interface SessionMetrics {
  readonly plannedNotes: number;
  readonly hitNotes: number;
  readonly missedNotes: number;
  readonly unjudgedNotes: number;
  readonly extraStrums: number;
  readonly brokenSustains: number;
  readonly bestCombo: number;
  readonly finalCombo: number;
  readonly noteAccuracy: RatioMetric;
  readonly timing: TimingMetrics;
  readonly articulationCompliance: RatioMetric;
  readonly strumDirectionCompliance: RatioMetric;
  readonly sustainCompletion: RatioMetric;
}

export interface EvidenceReference {
  readonly sessionId: string;
  readonly noteIds: readonly string[];
  readonly inputSequences: readonly number[];
  readonly judgmentSequences: readonly number[];
}

export type DiagnosticCode =
  | 'omission'
  | 'extra-input'
  | 'fret-substitution'
  | 'sequence-inversion'
  | 'chord-incomplete'
  | 'chord-extra-frets'
  | 'chord-substitution'
  | 'sustain-short'
  | 'wrong-strum-direction'
  | 'tap-strummed'
  | 'hopo-strummed'
  | 'timing-early-trend'
  | 'timing-late-trend'
  | 'transition-direction-gap';

export interface TrainingDiagnostic {
  readonly id: string;
  readonly code: DiagnosticCode;
  readonly basis: 'observed' | 'inferred';
  readonly occurrences: number;
  readonly sampleCount: number;
  readonly evidence: readonly EvidenceReference[];
}

export interface FretAccuracyMetric {
  readonly fret: Fret;
  readonly accuracy: RatioMetric;
  readonly unexpectedCount: number;
}

export interface TransitionAccuracyMetric {
  readonly from: NoteFrets;
  readonly to: NoteFrets;
  readonly accuracy: RatioMetric;
}

export interface ChordMetrics {
  readonly accuracy: RatioMetric;
  readonly incompleteCount: number;
  readonly extraFretsCount: number;
  readonly substitutionCount: number;
  readonly omittedCount: number;
}

export type SustainDurationMetric =
  | {
      readonly status: 'available';
      readonly unit: 'ratio';
      readonly numerator: Milliseconds;
      readonly denominator: Milliseconds;
      readonly value: number;
      readonly sampleCount: number;
    }
  | UnavailableMetric;

export interface StrumDirectionMetric {
  readonly direction: StrumDirection;
  readonly compliance: RatioMetric;
}

export interface AnalysisSlice {
  readonly id: string;
  readonly technique: Technique;
  readonly expectedNotes: number;
  readonly noteAccuracy: RatioMetric;
  readonly timing: TimingMetrics;
  readonly diagnosticIds: readonly string[];
}

export interface SessionAnalysisReport {
  readonly schemaVersion: 1;
  readonly policy: VersionedReference;
  readonly status: 'complete' | 'partial';
  readonly limitations: readonly (
    | 'input-recording-incomplete'
    | 'judgment-recording-incomplete'
    | 'cost-limit'
    | 'slice-limit'
    | 'unjudged-notes'
  )[];
  readonly analyzedNotes: number;
  readonly analyzedInputs: number;
  readonly timing: TimingMetrics;
  readonly alignment: {
    readonly maximumDistanceMs: Milliseconds;
    readonly cellsVisited: number;
  };
  readonly fretAccuracy: readonly FretAccuracyMetric[];
  readonly transitionAccuracy: readonly TransitionAccuracyMetric[];
  readonly chords: ChordMetrics;
  readonly sustainDuration: SustainDurationMetric;
  readonly strumDirection: readonly StrumDirectionMetric[];
  readonly techniques: readonly AnalysisSlice[];
  readonly segments: readonly AnalysisSlice[];
  readonly diagnostics: readonly TrainingDiagnostic[];
}

export type RecommendationChange =
  | { readonly kind: 'bpm'; readonly from: number; readonly to: number }
  | { readonly kind: 'level'; readonly from: DrillLevel; readonly to: DrillLevel }
  | {
      readonly kind: 'pattern';
      readonly from: VersionedReference;
      readonly to: VersionedReference;
    };

export interface TrainingRecommendation {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly policy: VersionedReference;
  readonly objective: 'timing' | 'accuracy' | 'articulation' | 'strum-direction' | 'sustain';
  readonly diagnosticIds: readonly string[];
  readonly evidence: readonly EvidenceReference[];
  readonly change: RecommendationChange;
  readonly resultingConfig: DrillConfig;
}
