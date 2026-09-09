import type {
  Chart, FretMask, HighwayBackendCapability, HighwayPresentationSnapshot, JudgmentEvent,
} from '@/engine/domain';

export type {
  HighwayBackendCapability, HighwayEffectsIntensity, HighwayFeedbackKind, HighwayLaneToken, HighwayMotionPolicy,
  HighwayNoteShape, HighwayPresentationProfile, HighwayPresentationSnapshot, HighwayProjection,
  HighwayVisualPreferences,
} from '@/engine/domain';

export interface HighwayViewport {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}

export interface HighwayFrame {
  readonly activeTimeMs: number;
  readonly visualOffsetMs: number;
  readonly activeFrets: FretMask;
}

export interface HighwayPreparation {
  readonly chart: Chart;
  readonly presentation: HighwayPresentationSnapshot;
}

export interface HighwayVisualEventUpdate {
  readonly judgments: readonly JudgmentEvent[];
  readonly visualTimeMs: number;
}

/** Fronteira visual: nenhum método recebe regras, entradas ou serviços de julgamento. */
export interface HighwayRendererBackend {
  readonly id: string;
  readonly capabilities: readonly HighwayBackendCapability[];
  readonly available: boolean;
  prepare(preparation: HighwayPreparation): void;
  resize(viewport: HighwayViewport): void;
  updateVisualEvents(update: HighwayVisualEventUpdate): void;
  invalidateStyles(): void;
  draw(frame: HighwayFrame): void;
  dispose(): void;
}
