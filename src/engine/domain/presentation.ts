import type { Fret, VersionedReference } from './music';
import { immutableCopy } from './immutable';
import {
  readBoolean, readChoice, readInteger, readNumber, readRecord, readReference,
  requireCondition, requireSameData,
} from './validation';

export type HighwayProjection = 'flat' | 'perspective';
export type HighwayEffectsIntensity = 'full' | 'reduced' | 'off';
export type HighwayMotionPolicy = 'full' | 'reduced';
export type HighwayNoteShape = 'circle' | 'diamond' | 'square';
export type HighwayBackendCapability = 'canvas-2d' | 'perspective-projection' | 'visual-effects';
export type HighwayFeedbackKind = 'hit' | 'early' | 'late' | 'miss' | 'extra' | 'sustain-broken' | 'sustain-complete';

export interface HighwayLaneToken {
  readonly fret: Fret;
  readonly position: 1 | 2 | 3 | 4 | 5;
  readonly color: string;
  readonly highContrastColor: string;
}

export interface HighwayPresentationProfile extends VersionedReference {
  readonly schemaVersion: 1;
  readonly displayName: string;
  readonly projection: {
    readonly mode: HighwayProjection;
    readonly vanishingPointXRatio: number;
    readonly farWidthRatio: number;
    readonly nearWidthRatio: number;
    readonly safeMarginRatio: number;
    readonly defaultIntensity: number;
    readonly minimumIntensity: number;
    readonly maximumIntensity: number;
  };
  readonly lanes: readonly HighwayLaneToken[];
  readonly laneGapRatio: number;
  readonly hitLine: { readonly positionRatio: number; readonly width: number };
  readonly visualSpeed: { readonly defaultPixelsPerSecond: number; readonly minimum: number; readonly maximum: number };
  readonly notes: {
    readonly strumShape: HighwayNoteShape;
    readonly hopoShape: HighwayNoteShape;
    readonly tapShape: HighwayNoteShape;
    readonly baseRadius: number;
    readonly minimumScale: number;
    readonly maximumScale: number;
    readonly chordConnectorWidth: number;
  };
  readonly sustains: { readonly width: number; readonly brokenDash: readonly [number, number] };
  readonly markers: { readonly subdivision: 1 | 2 | 4; readonly beatWidth: number; readonly measureWidth: number };
  readonly feedback: {
    readonly durationMs: number;
    readonly maximumActiveEffects: number;
    /** Ordem crescente: o último item tem maior prioridade quando o pool está cheio. */
    readonly priority: readonly HighwayFeedbackKind[];
  };
  readonly hud: { readonly accentToken: string; readonly surfaceToken: string; readonly textToken: string };
  readonly requiredCapabilities: readonly HighwayBackendCapability[];
  readonly fallback: 'flat-canvas-2d';
}

export interface HighwayVisualPreferences {
  readonly scrollSpeed: number;
  readonly noteScale: number;
  readonly perspectiveIntensity: number;
  readonly gridContrast: number;
  readonly effects: HighwayEffectsIntensity;
  readonly highContrast: boolean;
}

/** Condição visual congelada na tentativa; não participa do julgamento. */
export interface HighwayPresentationSnapshot {
  readonly schemaVersion: 1;
  readonly reference: VersionedReference;
  readonly profile: HighwayPresentationProfile;
  readonly preferences: HighwayVisualPreferences & { readonly motion: HighwayMotionPolicy };
}

export const FRETSENSE_HIGHWAY_PROFILE: HighwayPresentationProfile = immutableCopy({
  schemaVersion: 1, id: 'fretsense-highway', version: '1.1.0', displayName: 'Fretsense Highway',
  projection: {
    mode: 'perspective', vanishingPointXRatio: 0.5, farWidthRatio: 0.34, nearWidthRatio: 0.9,
    safeMarginRatio: 0.04, defaultIntensity: 0.86, minimumIntensity: 0, maximumIntensity: 1,
  },
  lanes: [
    { fret: 'G', position: 1, color: '#31d466', highContrastColor: '#54f48a' },
    { fret: 'R', position: 2, color: '#ff4054', highContrastColor: '#ff7180' },
    { fret: 'Y', position: 3, color: '#f2cc18', highContrastColor: '#ffe45c' },
    { fret: 'B', position: 4, color: '#438fff', highContrastColor: '#6fb4ff' },
    { fret: 'O', position: 5, color: '#ff7b2d', highContrastColor: '#ffa05f' },
  ],
  laneGapRatio: 0.013,
  hitLine: { positionRatio: 0.76, width: 4 },
  visualSpeed: { defaultPixelsPerSecond: 340, minimum: 180, maximum: 600 },
  notes: {
    strumShape: 'circle', hopoShape: 'diamond', tapShape: 'square', baseRadius: 20,
    minimumScale: 0.52, maximumScale: 1.14, chordConnectorWidth: 7,
  },
  sustains: { width: 11, brokenDash: [7, 7] },
  markers: { subdivision: 2, beatWidth: 1.25, measureWidth: 2.5 },
  feedback: {
    durationMs: 360, maximumActiveEffects: 16,
    priority: ['hit', 'sustain-complete', 'early', 'late', 'extra', 'miss', 'sustain-broken'],
  },
  hud: { accentToken: '--fs-accent', surfaceToken: '--fs-surface', textToken: '--fs-text' },
  requiredCapabilities: ['canvas-2d', 'perspective-projection', 'visual-effects'],
  fallback: 'flat-canvas-2d',
});

export const DEFAULT_HIGHWAY_PREFERENCES: HighwayVisualPreferences = Object.freeze({
  scrollSpeed: FRETSENSE_HIGHWAY_PROFILE.visualSpeed.defaultPixelsPerSecond,
  noteScale: 1, perspectiveIntensity: FRETSENSE_HIGHWAY_PROFILE.projection.defaultIntensity,
  gridContrast: 0.55, effects: 'full', highContrast: false,
});

function preferenceVersion(preferences: HighwayVisualPreferences, motion: HighwayMotionPolicy): string {
  return [FRETSENSE_HIGHWAY_PROFILE.version, `speed-${Math.round(preferences.scrollSpeed)}`,
    `scale-${Math.round(preferences.noteScale * 100)}`, `depth-${Math.round(preferences.perspectiveIntensity * 100)}`,
    `grid-${Math.round(preferences.gridContrast * 100)}`, `motion-${motion}`].join('+');
}

export function parseHighwayVisualPreferences(value: unknown, path = 'highwayPreferences'): HighwayVisualPreferences {
  const record = readRecord(value, path);
  return immutableCopy({
    scrollSpeed: readInteger(record.scrollSpeed, `${path}.scrollSpeed`,
      FRETSENSE_HIGHWAY_PROFILE.visualSpeed.minimum, FRETSENSE_HIGHWAY_PROFILE.visualSpeed.maximum),
    noteScale: readNumber(record.noteScale, `${path}.noteScale`, 0.8, 1.3),
    perspectiveIntensity: readNumber(record.perspectiveIntensity, `${path}.perspectiveIntensity`, 0, 1),
    gridContrast: readNumber(record.gridContrast, `${path}.gridContrast`, 0, 1),
    effects: readChoice(record.effects, ['full', 'reduced', 'off'], `${path}.effects`),
    highContrast: readBoolean(record.highContrast, `${path}.highContrast`),
  });
}

export function createHighwayPresentationSnapshot(
  preferences: HighwayVisualPreferences,
  motion: HighwayMotionPolicy,
): HighwayPresentationSnapshot {
  const parsed = parseHighwayVisualPreferences(preferences);
  readChoice(motion, ['full', 'reduced'], 'presentation.motion');
  return immutableCopy({
    schemaVersion: 1,
    reference: { id: FRETSENSE_HIGHWAY_PROFILE.id, version: preferenceVersion(parsed, motion) },
    profile: FRETSENSE_HIGHWAY_PROFILE,
    preferences: { ...parsed, motion },
  });
}

export const DEFAULT_HIGHWAY_PRESENTATION = createHighwayPresentationSnapshot(DEFAULT_HIGHWAY_PREFERENCES, 'full');

export function parseHighwayPresentationSnapshot(value: unknown): HighwayPresentationSnapshot {
  const snapshot = readRecord(value, 'presentation');
  readChoice(snapshot.schemaVersion, [1], 'presentation.schemaVersion');
  const reference = readReference(snapshot.reference, 'presentation.reference');
  requireSameData(snapshot.profile, FRETSENSE_HIGHWAY_PROFILE, 'presentation.profile');
  const preferencesRecord = readRecord(snapshot.preferences, 'presentation.preferences');
  const preferences = parseHighwayVisualPreferences(preferencesRecord, 'presentation.preferences');
  const motion = readChoice(preferencesRecord.motion, ['full', 'reduced'], 'presentation.preferences.motion');
  const expected = createHighwayPresentationSnapshot(preferences, motion);
  requireCondition(reference.id === expected.reference.id && reference.version === expected.reference.version,
    'presentation.reference', 'Presentation reference does not match its frozen settings.');
  return expected;
}

export const HIGHWAY_FRET_ORDER: readonly Fret[] = FRETSENSE_HIGHWAY_PROFILE.lanes.map(({ fret }) => fret);
