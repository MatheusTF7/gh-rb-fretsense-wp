import type { Milliseconds, VersionedReference } from './music';
import { immutableCopy } from './immutable';

/** Somente políticas definidas nesta etapa; novos comportamentos exigem nova versão. */
export interface RuleProfile extends VersionedReference {
  readonly hitWindow: {
    readonly earlyMs: Milliseconds;
    readonly lateMs: Milliseconds;
    readonly boundaries: 'inclusive';
  };
  readonly matching: {
    readonly candidate: 'earliest-pending-in-window';
    readonly tieBreak: 'chart-order';
    readonly wrongFretsOnStrum: 'consume-as-miss';
    readonly wrongFretsOnTransition: 'keep-pending';
  };
  readonly frets: {
    readonly matching: 'exact';
    readonly additionalFrets: 'reject';
    readonly anchoring: 'disabled';
  };
  readonly hopo: {
    readonly startAndRecovery: 'strum';
    readonly repeatedFrets: 'strum-required';
    readonly voluntaryStrum: 'hit-with-technique-failure';
  };
  readonly tap: {
    readonly trigger: 'fret-transition';
    readonly repeatedFrets: 'release-and-press';
    readonly strum: 'hit-with-technique-failure';
  };
  readonly chords: {
    readonly maximumSize: 3;
    readonly articulation: 'strum';
    /** Sem tolerância para completar o acorde depois do strum. */
    readonly formationGraceMs: 0;
  };
  readonly sustains: {
    readonly frets: 'exact';
    readonly releaseGraceMs: 0;
    readonly overlap: 'reject';
    readonly breakCombo: 'reset-once';
    readonly completionCombo: 'preserve';
  };
  readonly strum: {
    readonly extra: 'reset-combo';
    readonly direction: 'technique-only';
    readonly unknownDirection: 'not-evaluated';
  };
  readonly progression: {
    readonly completion: 'required';
    readonly interruptions: 'exclude-attempt';
    readonly requiredTechniqueData: 'must-be-available';
  };
}

/** Especificação do treinador; não declara equivalência com um jogo comercial. */
export const FRETSENSE_V1_RULE_PROFILE = immutableCopy({
  id: 'fretsense-v1',
  version: '1.0.0',
  hitWindow: { earlyMs: 120, lateMs: 120, boundaries: 'inclusive' },
  matching: {
    candidate: 'earliest-pending-in-window',
    tieBreak: 'chart-order',
    wrongFretsOnStrum: 'consume-as-miss',
    wrongFretsOnTransition: 'keep-pending',
  },
  frets: { matching: 'exact', additionalFrets: 'reject', anchoring: 'disabled' },
  hopo: {
    startAndRecovery: 'strum',
    repeatedFrets: 'strum-required',
    voluntaryStrum: 'hit-with-technique-failure',
  },
  tap: {
    trigger: 'fret-transition',
    repeatedFrets: 'release-and-press',
    strum: 'hit-with-technique-failure',
  },
  chords: { maximumSize: 3, articulation: 'strum', formationGraceMs: 0 },
  sustains: {
    frets: 'exact',
    releaseGraceMs: 0,
    overlap: 'reject',
    breakCombo: 'reset-once',
    completionCombo: 'preserve',
  },
  strum: {
    extra: 'reset-combo',
    direction: 'technique-only',
    unknownDirection: 'not-evaluated',
  },
  progression: {
    completion: 'required',
    interruptions: 'exclude-attempt',
    requiredTechniqueData: 'must-be-available',
  },
} as const satisfies RuleProfile);
