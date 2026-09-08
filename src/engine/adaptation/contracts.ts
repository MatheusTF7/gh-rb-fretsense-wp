import type {
  DiagnosticCode, SessionResult, SessionSnapshot, TrainingRecommendation, VersionedReference,
} from '../domain';

export const ADAPTATION_POLICY_REFERENCE: VersionedReference = Object.freeze({
  id: 'fretsense-rule-adaptation',
  version: '1.0.0',
});

export interface AdaptationPolicy {
  readonly reference: VersionedReference;
  readonly minimumNotes: number;
  readonly minimumDiagnosticSamples: number;
  readonly minimumDiagnosticOccurrences: number;
  readonly minimumConsistentAttempts: number;
  readonly minimumRegressionAttempts: number;
  readonly bpmIncrease: number;
  readonly bpmReduction: number;
}

export const DEFAULT_ADAPTATION_POLICY: AdaptationPolicy = Object.freeze({
  reference: ADAPTATION_POLICY_REFERENCE,
  minimumNotes: 8,
  minimumDiagnosticSamples: 4,
  minimumDiagnosticOccurrences: 2,
  minimumConsistentAttempts: 3,
  minimumRegressionAttempts: 2,
  bpmIncrease: 5,
  bpmReduction: 10,
});

export interface AdaptationAttempt {
  readonly snapshot: SessionSnapshot;
  readonly result: SessionResult;
}

export type AdaptationUnavailableReason =
  | 'attempt-ineligible'
  | 'insufficient-samples'
  | 'direction-unobserved'
  | 'awaiting-consistency'
  | 'catalog-limit'
  | 'no-actionable-evidence';

export type AdaptationEvaluation =
  | { readonly status: 'recommended'; readonly recommendation: TrainingRecommendation }
  | {
      readonly status: 'not-recommended';
      readonly reason: AdaptationUnavailableReason;
      readonly observedAttempts: number;
      readonly requiredAttempts: number;
    };

export const CORRECTIVE_DIAGNOSTIC_CODES: readonly DiagnosticCode[] = Object.freeze([
  'sequence-inversion', 'transition-direction-gap',
  'chord-incomplete', 'chord-extra-frets', 'chord-substitution',
  'wrong-strum-direction', 'extra-input',
  'timing-early-trend', 'timing-late-trend',
  'sustain-short',
]);
