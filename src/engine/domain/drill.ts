import type {
  Articulation,
  DrillLevel,
  MusicalTick,
  NoteFrets,
  StrumDirection,
  Subdivision,
  Technique,
  VersionedReference,
} from './music';

export interface TrainingGoals {
  /** Razão em [0, 1], não porcentagem em [0, 100]. */
  readonly minimumAccuracy: number;
  /** Misses de início + strums extras + quebras de sustain. */
  readonly maximumErrors: number;
  readonly consistentAttempts: number;
  /** Quando exigidas, metas técnicas precisam de razão 1 e dados completos. */
  readonly requireArticulation: boolean;
  readonly requireStrumDirection: boolean;
  readonly requireFullSustains: boolean;
}

export interface ManualPatternStep {
  readonly tick: MusicalTick;
  readonly frets: NoteFrets;
  readonly durationTicks: MusicalTick;
  readonly articulation: Articulation;
  /** Agrupa passos para análise e transições sem alterar o julgamento. */
  readonly segmentId: string;
}

export interface ManualPattern {
  readonly schemaVersion: 1;
  readonly lengthTicks: MusicalTick;
  readonly steps: readonly ManualPatternStep[];
}

export const MANUAL_PATTERN_REFERENCE = Object.freeze({ id: 'manual-pattern', version: '1.0.0' });

export type StrumDirectionGoal =
  | { readonly kind: 'none' }
  | { readonly kind: 'fixed'; readonly direction: StrumDirection }
  | {
      readonly kind: 'alternate';
      readonly firstDirection: StrumDirection;
      /** Intervalo sem notas, medido do fim anterior ao próximo início. */
      readonly resetAfterRestTicks: MusicalTick;
    };

export interface DrillConfig {
  readonly schemaVersion: 1;
  readonly technique: Technique;
  readonly level: DrillLevel;
  readonly pattern: VersionedReference;
  readonly bpm: number;
  readonly subdivision: Subdivision;
  readonly allowedFrets: NoteFrets;
  readonly patternLength: number;
  readonly length:
    | { readonly kind: 'repetitions'; readonly count: number }
    | { readonly kind: 'duration'; readonly ticks: MusicalTick };
  /** mixed delega a articulação de cada nota ao padrão versionado. */
  readonly articulation: Articulation | 'mixed';
  /** Uma nova pressão que completa os frets exatos pode acionar notas de strum. */
  readonly automaticStrum: boolean;
  readonly chordSize: 1 | 2 | 3;
  readonly sustainTicks: MusicalTick;
  readonly strumDirectionGoal: StrumDirectionGoal;
  readonly goals: TrainingGoals;
  readonly seed: string;
  readonly ruleProfile: VersionedReference;
  /** Presente somente quando `pattern` referencia `manual-pattern@1.0.0`. */
  readonly manualPattern?: ManualPattern;
}
