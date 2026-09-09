import type {
  Fret,
  FretMask,
  Milliseconds,
  NoteFrets,
  StrumDirection,
  VersionedReference,
} from './music';

export type InputSourceKind = 'keyboard' | 'gamepad' | 'webhid';

export interface DeviceRecognition {
  readonly category: 'keyboard' | 'guitar' | 'gamepad' | 'unknown';
  readonly family: 'guitar-hero' | 'rock-band' | 'other' | null;
  /** A família é apenas uma classificação do nome informado pelo navegador/dispositivo. */
  readonly basis: 'built-in' | 'reported-name' | 'unrecognized';
  readonly productName: string | null;
  readonly vendorId: number | null;
  readonly productId: number | null;
}

export interface NormalizedInputEvent {
  /** Inteiro crescente por tentativa, inclusive quando timestamps são iguais. */
  readonly sequence: number;
  /** Tempo ativo bruto; o julgador subtrai judgmentOffsetMs uma única vez. */
  readonly sessionTimeMs: Milliseconds;
  readonly timeSource: 'device' | 'observation';
  readonly activeFrets: FretMask;
  readonly pressedFrets: FretMask;
  readonly releasedFrets: FretMask;
  /** null = sem strum; unknown = houve strum sem direção observável. */
  readonly strum: StrumDirection | 'unknown' | null;
  readonly source: {
    readonly kind: InputSourceKind;
    readonly deviceProfileId: string;
    /** Distingue conexões do mesmo perfil; não é um índice fixo de Gamepad. */
    readonly connectionId: string;
  };
}

export type InputAction =
  | { readonly kind: 'fret'; readonly fret: Fret }
  | { readonly kind: 'strum'; readonly direction: StrumDirection | 'unknown' }
  | { readonly kind: 'pause' };

export type InputControl =
  | { readonly kind: 'key'; readonly code: string }
  | {
      readonly kind: 'button';
      readonly index: number;
      readonly pressThreshold: number;
      readonly releaseThreshold: number;
    }
  | {
      readonly kind: 'axis';
      readonly index: number;
      readonly direction: 'positive' | 'negative';
      readonly pressThreshold: number;
      readonly releaseThreshold: number;
    }
  | {
      /** Bit discreto de um input report WebHID; não atribui significado físico ao bit. */
      readonly kind: 'hid-bit';
      readonly reportId: number;
      readonly byteIndex: number;
      readonly bitIndex: number;
      readonly activeValue: 1;
    };

export interface DeviceProfile extends VersionedReference {
  readonly schemaVersion: 1;
  readonly label: string;
  readonly kind: InputSourceKind;
  readonly hardwareId: string | null;
  /** Identidade observável; perfis antigos recebem uma classificação conservadora ao serem lidos. */
  readonly recognition: DeviceRecognition;
  readonly bindings: readonly {
    readonly control: InputControl;
    readonly action: InputAction;
  }[];
  readonly capabilities: {
    readonly strum: 'directional' | 'undirected' | 'unavailable';
    /** null significa capacidade ainda desconhecida. */
    readonly maximumSimultaneousFrets: 1 | 2 | 3 | 4 | 5 | null;
    readonly confirmedChords: readonly NoteFrets[];
    readonly distinguishableExtraControls: readonly string[];
  };
  readonly calibrations: readonly VersionedReference[];
}

export interface CalibrationProfile extends VersionedReference {
  readonly schemaVersion: 1;
  readonly deviceProfile: VersionedReference;
  readonly method: 'default' | 'manual' | 'guided-combined';
  /** Positivo compensa entrada observada tarde: julgado = bruto - offset. */
  readonly judgmentOffsetMs: Milliseconds;
  /** Positivo atrasa a imagem: visual = bruto - offset. Não afeta julgamento. */
  readonly visualOffsetMs: Milliseconds;
  readonly sampleCount: number;
  readonly createdAtIso: string;
  readonly context: {
    readonly audioMode: 'enabled' | 'silent';
    readonly audioOutputId: string | null;
    readonly audioOutputLabel: string | null;
    readonly browser: string;
    readonly operatingSystem: string;
    readonly sampleRateHz: number | null;
  };
}
