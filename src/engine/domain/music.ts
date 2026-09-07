/** Contratos de dados; invariantes e unidades estão em docs/gameplay-rules.md. */
export type Milliseconds = number;
export type MusicalTick = number;

export interface VersionedReference {
  readonly id: string;
  readonly version: string;
}

export const TICKS_PER_QUARTER = 480;

export const FRET_BITS = {
  G: 1,
  R: 2,
  Y: 4,
  B: 8,
  O: 16,
} as const;

export type Fret = keyof typeof FRET_BITS;

/** Zero representa nenhum fret; acordes continuam sendo uma única máscara. */
export type FretMask =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25
  | 26
  | 27
  | 28
  | 29
  | 30
  | 31;

export type NoteFrets = Exclude<FretMask, 0>;
export type Articulation = 'strum' | 'hopo' | 'tap';
export type StrumDirection = 'up' | 'down';
export type Technique =
  | 'single-strum'
  | 'alternate-strum'
  | 'hopo'
  | 'tapping'
  | 'sequences'
  | 'chords'
  | 'sustains'
  | 'mixed';

export type DrillLevel = 'beginner' | 'intermediate' | 'advanced';
/** Quantidade de divisões iguais por semínima, incluindo tercinas. */
export type Subdivision = 1 | 2 | 3 | 4 | 6 | 8;

export interface ChartNote {
  readonly id: string;
  readonly tick: MusicalTick;
  readonly frets: NoteFrets;
  /** Zero para nota sem sustain. */
  readonly durationTicks: MusicalTick;
  readonly articulation: Articulation;
  readonly origin: {
    readonly segmentId: string;
    readonly patternId: string;
    readonly technique: Technique;
    /** Índice baseado em zero. */
    readonly repetition: number;
  };
  /** Direção é uma meta técnica; null significa sem exigência para esta nota. */
  readonly expectedStrumDirection: StrumDirection | null;
}

export interface Chart {
  readonly id: string;
  readonly ticksPerQuarter: typeof TICKS_PER_QUARTER;
  readonly bpm: number;
  /** Inclui pausas musicais e todas as caudas, mas não a janela tardia final. */
  readonly lengthTicks: MusicalTick;
  readonly generator: VersionedReference;
  readonly seed: string;
  /** Ordem canônica por tick crescente; um único início por tick no perfil v1. */
  readonly notes: readonly ChartNote[];
}
