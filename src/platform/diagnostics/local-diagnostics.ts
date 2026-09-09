import type {
  HighwayVisualPreferences, SessionResult, SessionSnapshot, SessionState,
} from '@/engine/domain';
import type { SessionStorageState } from '@/platform/storage';

export const FRETSENSE_APP_VERSION = '0.0.1';
export const LOCAL_DIAGNOSTIC_SCHEMA_VERSION = 1;

export interface LocalDiagnosticContext {
  readonly snapshot: SessionSnapshot;
  readonly state: SessionState;
  readonly activeTimeMs: number;
  readonly inputCount: number;
  readonly judgmentCount: number;
  readonly interruptionCount: number;
  readonly currentVisualPreferences: HighwayVisualPreferences;
  readonly result: SessionResult | null;
  readonly storage: SessionStorageState;
}

/** Montado somente por ação explícita; o aplicativo não envia este conteúdo. */
export function createLocalDiagnostic(context: LocalDiagnosticContext) {
  const { snapshot, result } = context;
  return Object.freeze({
    schemaVersion: LOCAL_DIAGNOSTIC_SCHEMA_VERSION,
    product: 'fretsense',
    appVersion: FRETSENSE_APP_VERSION,
    generatedAtIso: new Date().toISOString(),
    session: {
      id: snapshot.id,
      state: context.state,
      mode: snapshot.mode,
      createdAtIso: snapshot.createdAtIso,
      activeTimeMs: Math.round(context.activeTimeMs),
      inputCount: context.inputCount,
      judgmentCount: context.judgmentCount,
      interruptionCount: context.interruptionCount,
      ending: result?.ending ?? null,
    },
    exercise: {
      technique: snapshot.config.technique,
      level: snapshot.config.level,
      bpm: snapshot.chart.bpm,
      seed: snapshot.config.seed,
      noteCount: snapshot.chart.notes.length,
      chartId: snapshot.chart.id,
      generator: snapshot.chart.generator,
      rules: snapshot.config.ruleProfile,
      presentation: {
        reference: snapshot.presentation?.reference ?? null,
        frozenPreferences: snapshot.presentation?.preferences ?? null,
        currentPreferences: context.currentVisualPreferences,
      },
    },
    input: {
      profile: { id: snapshot.device.id, version: snapshot.device.version, kind: snapshot.device.kind,
        hardwareId: snapshot.device.hardwareId, recognition: snapshot.device.recognition },
      capabilities: snapshot.device.capabilities,
      calibration: {
        id: snapshot.calibration.id,
        version: snapshot.calibration.version,
        method: snapshot.calibration.method,
        audioMode: snapshot.calibration.context.audioMode,
        sampleRateHz: snapshot.calibration.context.sampleRateHz,
        judgmentOffsetMs: snapshot.calibration.judgmentOffsetMs,
        visualOffsetMs: snapshot.calibration.visualOffsetMs,
      },
    },
    storage: context.storage,
    runtime: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      visibilityState: document.visibilityState,
      secureContext: globalThis.isSecureContext,
      capabilities: {
        audioContext: typeof globalThis.AudioContext === 'function',
        fullscreen: typeof document.documentElement.requestFullscreen === 'function',
        gamepad: typeof navigator.getGamepads === 'function',
        webHid: globalThis.isSecureContext === true && 'hid' in navigator,
        indexedDb: typeof globalThis.indexedDB !== 'undefined',
        resizeObserver: typeof globalThis.ResizeObserver === 'function',
      },
    },
  });
}
