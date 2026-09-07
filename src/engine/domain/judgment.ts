import type { FretMask, Milliseconds } from './music';

export type TechnicalObjective = 'articulation' | 'strum-direction' | 'sustain';

export interface TechniqueAssessment {
  readonly objective: TechnicalObjective;
  readonly outcome: 'passed' | 'failed' | 'not-evaluated' | 'not-applicable';
  /** Código estável para explicação/tradução; null quando não há ressalva. */
  readonly reason:
    | 'strum-used-for-tap'
    | 'voluntary-strum-on-hopo'
    | 'wrong-strum-direction'
    | 'unknown-strum-direction'
    | 'no-strum-observed'
    | 'frets-changed-during-sustain'
    | 'head-after-tail'
    | 'attempt-aborted'
    | null;
}

export interface ComboChange {
  readonly before: number;
  readonly after: number;
  readonly effect: 'increment' | 'reset' | 'preserve';
}

interface JudgmentBase {
  /** Sequência própria de saída, independente da sequência de entrada. */
  readonly sequence: number;
  /** Linha de tempo musical corrigida, inclusive para expiração pelo relógio. */
  readonly timeMs: Milliseconds;
  readonly combo: ComboChange;
}

export type JudgmentEvent = JudgmentBase &
  (
    | {
        readonly kind: 'note-hit';
        readonly noteId: string;
        readonly inputSequence: number;
        readonly timingErrorMs: Milliseconds;
        readonly trigger: 'strum' | 'hopo' | 'tap';
        readonly technique: readonly TechniqueAssessment[];
      }
    | {
        readonly kind: 'note-miss';
        readonly cause: 'wrong-frets';
        readonly noteId: string;
        readonly inputSequence: number;
        readonly timingErrorMs: Milliseconds;
        readonly activeFrets: FretMask;
        readonly missingFrets: FretMask;
        readonly extraFrets: FretMask;
      }
    | {
        readonly kind: 'note-miss';
        readonly cause: 'window-expired' | 'missing-strum';
        readonly noteId: string;
        readonly inputSequence: null;
        readonly timingErrorMs: null;
      }
    | {
        readonly kind: 'extra-strum';
        readonly noteId: null;
        readonly inputSequence: number;
        readonly timingErrorMs: null;
      }
    | {
        readonly kind: 'sustain';
        readonly noteId: string;
        /** null para conclusão pelo relógio, retomada ou cancelamento. */
        readonly inputSequence: number | null;
        readonly outcome: 'completed' | 'broken' | 'not-evaluated' | 'cancelled';
        readonly heldDurationMs: Milliseconds;
        readonly requiredDurationMs: Milliseconds;
        readonly technique: TechniqueAssessment;
      }
  );
