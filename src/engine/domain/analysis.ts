import type { DrillConfig } from './drill';
import type { DrillLevel, Milliseconds, VersionedReference } from './music';

export interface UnavailableMetric {
  readonly status: 'unavailable';
  readonly reason: 'no-samples' | 'insufficient-data' | 'unsupported-capability' | 'not-applicable';
}

export type RatioMetric =
  | {
      readonly status: 'available';
      readonly numerator: number;
      readonly denominator: number;
      /** Razão em [0, 1]. */
      readonly value: number;
    }
  | UnavailableMetric;

export type TimingMetrics =
  | {
      readonly status: 'available';
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

export interface TrainingDiagnostic {
  readonly id: string;
  readonly code: string;
  readonly basis: 'observed' | 'inferred';
  readonly occurrences: number;
  readonly sampleCount: number;
  readonly evidence: readonly EvidenceReference[];
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
