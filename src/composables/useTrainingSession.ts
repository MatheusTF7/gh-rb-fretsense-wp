import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';
import type {
  CalibrationProfile, Chart, DrillConfig, DrillLevel, Fret, JudgmentEvent, NoteFrets,
  SessionMode, SessionResult, SessionSnapshot, Subdivision, Technique,
} from '@/engine/domain';
import {
  countFrets, createHighwayPresentationSnapshot, ENGINE_LIMITS, EngineError, FRET_BITS,
  MANUAL_PATTERN_REFERENCE, parseDrillConfig, requireCondition, sameReference, TICKS_PER_QUARTER,
} from '@/engine/domain';
import { DRILL_PRESETS, getDrillPreset, getTechniqueDescriptor } from '@/catalog';
import { generateDrill } from '@/engine/generation';
import { TrainingSession, type SessionEvaluation, type SessionView } from '@/engine/session';
import { SessionAudio } from '@/platform/audio/session-audio';
import { captureContext, createCalibration, matchesCalibration } from '@/platform/calibration/profiles';
import {
  createSessionInput, DEFAULT_KEYBOARD, GamepadDiscovery,
  type BrowserInputAdapter, type GamepadConnection, type InputInterruption,
} from '@/platform/input';
import { SessionClock } from '@/platform/timing/session-clock';
import { useCalibrationStore } from '@/stores/calibration';
import { useAdaptationStore } from '@/stores/adaptation';
import { useHistoryStore } from '@/stores/history';
import { useInterfaceStore } from '@/stores/interface';
import { useTrainingStore } from '@/stores/training';

export type PlayFailure =
  | 'audio-unavailable'
  | 'calibration-mismatch'
  | 'configuration-invalid'
  | 'device-incompatible'
  | 'device-unavailable'
  | 'input-interrupted';

export interface ConfigurationPreview {
  readonly ok: true;
  readonly config: DrillConfig;
  readonly chart: Chart;
}

export interface ConfigurationFailure {
  readonly ok: false;
  readonly code: EngineError['code'] | 'unknown';
  readonly path: string;
  readonly message: string;
}

const EMPTY_VIEW: SessionView = Object.freeze({
  state: 'idle', sessionId: null, activeTimeMs: 0, countdownRemainingMs: 0,
  activeFrets: 0, inputCount: 0, interruptionCount: 0, result: null,
});
const FRET_ORDER: readonly Fret[] = ['G', 'R', 'Y', 'B', 'O'];

let identitySequence = 0;
function identity() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++identitySequence}`;
}

function requiredNumber(value: number | string | null, path: string): number {
  requireCondition(value !== null && value !== '', path, 'A numeric value is required.', 'invalid-type');
  const numeric = Number(value);
  requireCondition(Number.isFinite(numeric), path, 'A finite numeric value is required.', 'invalid-type');
  return numeric;
}

function segmentKey(segmentId: string): string {
  return segmentId.split(':').slice(2).join(':');
}

function focusConfig(config: DrillConfig, chart: Chart, selectedSegment: string): DrillConfig {
  const notes = chart.notes.filter((note) => note.origin.repetition === 0
    && segmentKey(note.origin.segmentId) === selectedSegment);
  const firstNote = notes[0];
  requireCondition(firstNote !== undefined, 'config.focusSegment', 'Selected segment is not available.');
  const firstTick = firstNote.tick;
  const stepTicks = chart.ticksPerQuarter / config.subdivision;
  const lengthTicks = Math.max(...notes.map((note) => note.tick + Math.max(note.durationTicks, stepTicks))) - firstTick;
  const articulations = new Set(notes.map((note) => note.articulation));
  const hasStrum = notes.some((note) => note.articulation === 'strum');
  const hasSustain = notes.some((note) => note.durationTicks > 0);
  const chordSize = Math.max(...notes.map((note) => countFrets(note.frets))) as 1 | 2 | 3;
  return parseDrillConfig({
    ...config,
    pattern: MANUAL_PATTERN_REFERENCE,
    patternLength: notes.length,
    articulation: articulations.size === 1 ? firstNote.articulation : 'mixed',
    chordSize,
    sustainTicks: 0,
    strumDirectionGoal: hasStrum ? config.strumDirectionGoal : { kind: 'none' },
    goals: {
      ...config.goals,
      requireStrumDirection: hasStrum && config.goals.requireStrumDirection,
      requireFullSustains: hasSustain && config.goals.requireFullSustains,
    },
    manualPattern: {
      schemaVersion: 1,
      lengthTicks,
      steps: notes.map((note) => ({
        tick: note.tick - firstTick,
        frets: note.frets,
        durationTicks: note.durationTicks,
        articulation: note.articulation,
        segmentId: selectedSegment,
      })),
    },
  });
}

export function useTrainingSession() {
  const route = useRoute();
  const ui = useInterfaceStore();
  const calibrations = useCalibrationStore();
  const adaptation = useAdaptationStore();
  const history = useHistoryStore();
  const workspace = useTrainingStore();
  const captureArea = ref<HTMLElement | null>(null);
  const profileId = ref(ui.selectedProfileId);
  const presetId = ref<string | null>(null);
  const configTemplate = shallowRef<DrillConfig | null>(null);
  const mode = ref<SessionMode>('practice');
  const bpm = ref<number | string | null>(80);
  const seed = ref('fretsense');
  const subdivision = ref<Subdivision>(2);
  const allowedFrets = ref<Fret[]>(['G', 'R', 'Y']);
  const lengthKind = ref<'repetitions' | 'duration'>('repetitions');
  const lengthValue = ref<number | string | null>(4);
  const automaticStrum = ref(false);
  const minimumAccuracy = ref<number | string | null>(90);
  const maximumErrors = ref<number | string | null>(4);
  const consistentAttempts = ref<number | string | null>(3);
  const requireArticulation = ref(true);
  const requireStrumDirection = ref(false);
  const requireFullSustains = ref(false);
  const focusSegment = ref<string | null>(null);
  const audioMode = ref<'enabled' | 'silent'>('enabled');
  const calibrationId = ref<string | null>(null);
  const connections = shallowRef<readonly GamepadConnection[]>([]);
  const discoveryUnavailable = ref(false);
  const starting = ref(false);
  const failure = ref<PlayFailure | null>(null);
  const snapshot = shallowRef<SessionSnapshot | null>(null);
  const view = shallowRef<SessionView>(EMPTY_VIEW);
  const evaluation = shallowRef<SessionEvaluation | null>(null);
  const judgmentBuffer: JudgmentEvent[] = [];
  const judgments = shallowRef<readonly JudgmentEvent[]>(judgmentBuffer);
  const latestJudgment = shallowRef<JudgmentEvent | null>(null);
  const result = shallowRef<SessionResult | null>(null);
  const systemReducedMotion = ref(false);
  const presentation = computed(() => createHighwayPresentationSnapshot(
    ui.highway,
    ui.reducedMotion || systemReducedMotion.value ? 'reduced' : 'full',
  ));

  function saveDraft(config: DrillConfig): void {
    workspace.saveDraft(config, selectedPreset.value?.id ?? config.pattern.id, focusSegment.value, {
      mode: mode.value,
      profileId: profileId.value,
      audioMode: audioMode.value,
      calibrationId: calibrationId.value,
    });
  }

  const selectedPreset = computed(() => presetId.value ? getDrillPreset(presetId.value) : undefined);
  const technique = computed<Technique | null>({
    get: () => selectedPreset.value?.technique ?? null,
    set: (value) => { if (value) selectTechniqueLevel(value, level.value ?? 'beginner'); },
  });
  const level = computed<DrillLevel | null>({
    get: () => selectedPreset.value?.level ?? null,
    set: (value) => { if (value && technique.value) selectTechniqueLevel(technique.value, value); },
  });
  const descriptor = computed(() => technique.value ? getTechniqueDescriptor(technique.value) : null);
  const profile = computed(() => ui.profiles.find((item) => item.id === profileId.value) ?? DEFAULT_KEYBOARD);
  const matchingConnections = computed(() => connections.value.filter((item) => item.hardwareId === profile.value.hardwareId));
  const selectedConnection = computed(() => {
    const selection = ui.selectedGamepad;
    return selection ? matchingConnections.value.find((connection) =>
      connection.index === selection.index && connection.hardwareId === selection.hardwareId) : undefined;
  });
  const connectionId = computed({
    get: () => selectedConnection.value?.connectionId ?? null,
    set: (id: string | null) => ui.selectGamepad(matchingConnections.value.find((connection) => connection.connectionId === id) ?? null),
  });
  const availableCalibrations = computed(() => calibrations.records.filter((item) =>
    sameReference(item.deviceProfile, profile.value) && item.context.audioMode === audioMode.value));
  const configurationLocked = computed(() => snapshot.value !== null || starting.value);
  const state = computed(() => view.value.state);
  const isActive = computed(() => state.value === 'countdown' || state.value === 'running');
  const isPaused = computed(() => state.value === 'paused');
  const isFinished = computed(() => state.value === 'completed' || state.value === 'aborted');
  const countdownBeat = computed(() => {
    if (!snapshot.value || state.value !== 'countdown') return 0;
    return Math.max(1, Math.ceil(view.value.countdownRemainingMs / (60_000 / snapshot.value.chart.bpm)));
  });
  const resolvedNotes = computed(() => evaluation.value
    ? evaluation.value.metrics.hitNotes + evaluation.value.metrics.missedNotes : 0);
  const progress = computed(() => snapshot.value && snapshot.value.chart.notes.length
    ? resolvedNotes.value / snapshot.value.chart.notes.length : 0);
  const judgmentCount = computed(() => evaluation.value?.judgmentCount ?? 0);
  const durationMaximumBeats = computed(() => Math.min(
    Math.floor(ENGINE_LIMITS.maximumTicks / TICKS_PER_QUARTER),
    Math.max(1, Math.floor(ENGINE_LIMITS.maximumDurationMs * Number(bpm.value) / 60_000 || 1)),
  ));

  function fretMask(): NoteFrets {
    return allowedFrets.value.reduce<number>((mask, fret) => mask | FRET_BITS[fret], 0) as NoteFrets;
  }

  function loadConfig(config: DrillConfig): void {
    const preset = getDrillPreset(config.pattern.id)
      ?? DRILL_PRESETS.find((item) => item.technique === config.technique && item.level === config.level);
    if (preset) presetId.value = preset.id;
    configTemplate.value = config;
    bpm.value = config.bpm;
    seed.value = config.seed;
    subdivision.value = config.subdivision;
    allowedFrets.value = FRET_ORDER.filter((fret) => (config.allowedFrets & FRET_BITS[fret]) !== 0);
    lengthKind.value = config.length.kind;
    lengthValue.value = config.length.kind === 'repetitions' ? config.length.count : config.length.ticks / 480;
    automaticStrum.value = config.automaticStrum;
    minimumAccuracy.value = config.goals.minimumAccuracy * 100;
    maximumErrors.value = config.goals.maximumErrors;
    consistentAttempts.value = config.goals.consistentAttempts;
    requireArticulation.value = config.goals.requireArticulation;
    requireStrumDirection.value = config.goals.requireStrumDirection;
    requireFullSustains.value = config.goals.requireFullSustains;
    focusSegment.value = null;
  }

  function selectPreset(id: string): void {
    const preset = getDrillPreset(id);
    if (!preset) return;
    presetId.value = id;
    loadConfig(preset.config);
    failure.value = null;
  }

  function selectTechniqueLevel(nextTechnique: Technique, nextLevel: DrillLevel): void {
    const preset = DRILL_PRESETS.find((item) => item.technique === nextTechnique && item.level === nextLevel)
      ?? DRILL_PRESETS.find((item) => item.technique === nextTechnique);
    if (preset) selectPreset(preset.id);
  }

  function buildBaseConfig(): DrillConfig {
    const preset = selectedPreset.value;
    requireCondition(preset !== undefined, 'config.preset', 'Choose a catalog preset.');
    const policy = getTechniqueDescriptor(preset.technique).parameters;
    const numericBpm = requiredNumber(bpm.value, 'config.bpm');
    requireCondition(numericBpm >= policy.bpm.minimum && numericBpm <= policy.bpm.maximum,
      'config.bpm', 'BPM is outside this technique range.');
    requireCondition(policy.subdivisions.includes(subdivision.value),
      'config.subdivision', 'Subdivision is outside this technique range.');
    const numericLength = requiredNumber(lengthValue.value, 'config.length');
    const template = configTemplate.value ?? preset.config;
    return parseDrillConfig({
      ...template,
      bpm: numericBpm,
      seed: seed.value,
      subdivision: subdivision.value,
      allowedFrets: fretMask(),
      length: lengthKind.value === 'repetitions'
        ? { kind: 'repetitions', count: numericLength }
        : { kind: 'duration', ticks: numericLength * 480 },
      automaticStrum: automaticStrum.value,
      goals: {
        minimumAccuracy: requiredNumber(minimumAccuracy.value, 'config.goals.minimumAccuracy') / 100,
        maximumErrors: requiredNumber(maximumErrors.value, 'config.goals.maximumErrors'),
        consistentAttempts: requiredNumber(consistentAttempts.value, 'config.goals.consistentAttempts'),
        requireArticulation: requireArticulation.value,
        requireStrumDirection: requireStrumDirection.value,
        requireFullSustains: requireFullSustains.value,
      },
    });
  }

  function buildConfig(): DrillConfig {
    const base = buildBaseConfig();
    const chart = generateDrill(base);
    return focusSegment.value ? focusConfig(base, chart, focusSegment.value) : base;
  }

  const segmentOptions = computed(() => {
    try {
      const chart = generateDrill(buildBaseConfig());
      return [...new Set(chart.notes.filter((note) => note.origin.repetition === 0)
        .map((note) => segmentKey(note.origin.segmentId)))].filter(Boolean);
    } catch {
      return [];
    }
  });

  const preview = computed<ConfigurationPreview | ConfigurationFailure>(() => {
    try {
      const config = buildConfig();
      return { ok: true, config, chart: generateDrill(config) };
    } catch (error) {
      return error instanceof EngineError
        ? { ok: false, code: error.code, path: error.path, message: error.message }
        : { ok: false, code: 'unknown', path: 'config', message: 'Configuration could not be generated.' };
    }
  });

  const requirements = computed(() => {
    if (!preview.value.ok) return null;
    const { chart, config } = preview.value;
    const allAutomatic = config.automaticStrum && chart.notes.every((note) => note.articulation === 'strum');
    return {
      needsStrum: !allAutomatic && chart.notes.some((note) => note.articulation !== 'tap'),
      needsDirection: chart.notes.some((note) => note.expectedStrumDirection !== null),
      maximumSimultaneousFrets: Math.max(...chart.notes.map((note) => countFrets(note.frets))),
      usesSustains: chart.notes.some((note) => note.durationTicks > 0),
    };
  });

  const compatibility = computed(() => {
    const required = requirements.value;
    if (!required) return { compatible: false, reason: 'invalid-configuration' as const };
    if (required.needsStrum && profile.value.capabilities.strum === 'unavailable') {
      return { compatible: false, reason: 'strum-unavailable' as const };
    }
    if (required.needsDirection && profile.value.capabilities.strum !== 'directional') {
      return { compatible: false, reason: 'direction-unavailable' as const };
    }
    const maximum = profile.value.capabilities.maximumSimultaneousFrets;
    if (maximum !== null && maximum < required.maximumSimultaneousFrets) {
      return { compatible: false, reason: 'simultaneity-unavailable' as const };
    }
    return { compatible: true, reason: maximum === null && required.maximumSimultaneousFrets > 1
      ? 'simultaneity-unconfirmed' as const : null };
  });
  const directionGoalAvailable = computed(() => requirements.value?.needsDirection ?? false);
  const sustainGoalAvailable = computed(() => requirements.value?.usesSustains ?? false);

  const services = {
    clock: new SessionClock(),
    nextIdentity: () => ({ id: `session-${identity()}`, createdAtIso: new Date().toISOString() }),
    utcNow: () => new Date().toISOString(),
  };
  let session: TrainingSession | null = null;
  let input: BrowserInputAdapter | null = null;
  let audio: SessionAudio | null = null;
  let discovery: GamepadDiscovery | null = null;
  let discoveryTimer: ReturnType<typeof setInterval> | null = null;
  let motionQuery: MediaQueryList | null = null;
  let frame: number | null = null;
  let operation = 0;
  let disposed = false;

  function refreshDevices() {
    if (document.hidden) return;
    try {
      connections.value = discovery?.list() ?? [];
      discoveryUnavailable.value = false;
      if (!selectedConnection.value && matchingConnections.value.length === 1) {
        ui.selectGamepad(matchingConnections.value[0] ?? null);
      }
    } catch {
      connections.value = [];
      discoveryUnavailable.value = true;
    }
  }

  function resolveCalibration(sessionAudio: SessionAudio): CalibrationProfile {
    const selected = availableCalibrations.value.find((item) => item.id === calibrationId.value);
    if (selected) {
      const currentContext = captureContext(
        audioMode.value,
        audioMode.value === 'enabled' ? sessionAudio.metronome.sampleRateHz : null,
        audioMode.value === 'enabled' ? sessionAudio.metronome.outputId : null,
        selected.context.audioOutputLabel ?? '',
      );
      if (!matchesCalibration(selected, profile.value, currentContext)) throw new Error('calibration-mismatch');
      return selected;
    }
    return createCalibration(profile.value, captureContext(
      audioMode.value,
      audioMode.value === 'enabled' ? sessionAudio.metronome.sampleRateHz : null,
      audioMode.value === 'enabled' ? sessionAudio.metronome.outputId : null,
      '',
    ), 'default');
  }

  function stopFrame() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  function stopInput() {
    const previous = input;
    input = null;
    previous?.dispose();
  }

  async function releaseRuntime() {
    stopFrame();
    stopInput();
    const previousAudio = audio;
    audio = null;
    if (previousAudio) await previousAudio.dispose();
  }

  function refreshState() {
    if (!session) return;
    view.value = session.getView();
    snapshot.value = session.getSnapshot();
    evaluation.value = session.getEvaluation();
    result.value = view.value.result;
    const count = evaluation.value?.judgmentCount ?? 0;
    if (count !== judgmentBuffer.length) {
      const next = session.getJudgmentsFrom(judgmentBuffer.length);
      judgmentBuffer.push(...next);
      latestJudgment.value = judgmentBuffer.at(-1) ?? null;
    }
    const currentResult = result.value;
    const currentSnapshot = snapshot.value;
    if (currentResult && currentSnapshot && workspace.latestRecord?.result.sessionId !== currentResult.sessionId) {
      workspace.saveResult(currentSnapshot, currentResult);
      const completedSession = session;
      window.setTimeout(() => {
        void history.persist(currentSnapshot, currentResult,
          completedSession.getInputs(), completedSession.getJudgments());
        void adaptation.evaluate(currentSnapshot, currentResult);
      }, 0);
    }
    if (view.value.state === 'paused' || view.value.state === 'completed' || view.value.state === 'aborted') {
      stopFrame();
      stopInput();
      audio?.metronome.stop();
    }
  }

  function animate() {
    frame = null;
    if (!session || !['countdown', 'running'].includes(session.getView().state)) return;
    session.advance();
    audio?.synchronize();
    refreshState();
    if (session && ['countdown', 'running'].includes(session.getView().state)) frame = requestAnimationFrame(animate);
  }

  function inputInterrupted(reason: InputInterruption) {
    failure.value = reason === 'user-pause' ? null
      : reason === 'context-changed' ? 'device-unavailable' : 'input-interrupted';
    audio?.synchronize();
    refreshState();
    stopFrame();
  }

  function createInput(target: TrainingSession): BrowserInputAdapter {
    const scope = captureArea.value;
    const targetSnapshot = target.getSnapshot();
    if (!scope || !targetSnapshot) throw new Error('capture-unavailable');
    const connection = selectedConnection.value;
    if (targetSnapshot.device.kind === 'gamepad' && !connection) throw new Error('device-unavailable');
    return createSessionInput(target, {
      scope,
      ...(targetSnapshot.device.kind === 'gamepad' && connection ? { gamepad: connection } : {}),
    }, inputInterrupted, { onEvent: refreshState, onBaseline: refreshState });
  }

  function clearAttemptState(): void {
    snapshot.value = null;
    view.value = EMPTY_VIEW;
    evaluation.value = null;
    judgmentBuffer.length = 0;
    judgments.value = judgmentBuffer;
    latestJudgment.value = null;
    result.value = null;
  }

  function activatePrepared(next: TrainingSession, nextAudio: SessionAudio): void {
    session = next;
    const nextSnapshot = next.getSnapshot();
    snapshot.value = nextSnapshot;
    if (nextSnapshot) {
      seed.value = nextSnapshot.config.seed;
      saveDraft(nextSnapshot.config);
    }
    const nextInput = createInput(next);
    input = nextInput;
    nextInput.start();
    if (!nextInput.capturing) throw new Error('device-unavailable');
    next.start();
    nextAudio.synchronize();
    judgments.value = Object.freeze([]);
    latestJudgment.value = null;
    evaluation.value = null;
    result.value = null;
    refreshState();
    if (isActive.value) frame = requestAnimationFrame(animate);
  }

  async function startAttempt() {
    const token = ++operation;
    starting.value = true;
    failure.value = null;
    if (!preview.value.ok) {
      failure.value = 'configuration-invalid';
      starting.value = false;
      return;
    }
    if (!compatibility.value.compatible) {
      failure.value = 'device-incompatible';
      starting.value = false;
      return;
    }
    if (session && ['ready', 'countdown', 'running', 'paused'].includes(session.getView().state)) session.abort('restart');
    session = null;
    clearAttemptState();
    await releaseRuntime();
    if (disposed || token !== operation) return;
    const next = new TrainingSession(services);
    const nextAudio = new SessionAudio(next, () => {
      failure.value = 'audio-unavailable';
      stopInput();
      refreshState();
      stopFrame();
    });
    audio = nextAudio;
    try {
      if (audioMode.value === 'enabled' && !await nextAudio.metronome.enable()) throw new Error('audio-unavailable');
      if (disposed || token !== operation) {
        await nextAudio.dispose();
        return;
      }
      refreshDevices();
      if (profile.value.kind === 'gamepad' && !selectedConnection.value) throw new Error('device-unavailable');
      const config = preview.value.ok ? preview.value.config : buildConfig();
      saveDraft(config);
      adaptation.beginAttempt();
      void adaptation.finalizeAdjustment(config);
      const calibration = resolveCalibration(nextAudio);
      next.prepare({ mode: mode.value, config, device: profile.value, calibration, presentation: presentation.value });
      next.enableInitialJudgment();
      activatePrepared(next, nextAudio);
    } catch (error) {
      if (!['idle', 'completed', 'aborted'].includes(next.getView().state)) next.abort('unrecoverable-error');
      session = null;
      clearAttemptState();
      failure.value = error instanceof Error && error.message === 'audio-unavailable' ? 'audio-unavailable'
        : error instanceof Error && error.message === 'device-unavailable' ? 'device-unavailable'
          : error instanceof Error && error.message === 'calibration-mismatch' ? 'calibration-mismatch'
            : 'configuration-invalid';
      await releaseRuntime();
    } finally {
      if (token === operation) starting.value = false;
    }
  }

  async function launchNext(kind: 'repeat' | 'vary' | 'restart') {
    const previous = session;
    if (!previous || starting.value) return;
    starting.value = true;
    failure.value = null;
    let next: TrainingSession | null = null;
    try {
      next = kind === 'restart' ? previous.restart()
        : kind === 'vary' ? previous.vary(`${previous.getSnapshot()?.config.seed ?? 'variation'}:${identity()}`)
          : previous.repeat();
      const previousSnapshot = previous.getSnapshot();
      const previousResult = previous.getView().result;
      if (previousSnapshot && previousResult && workspace.latestRecord?.result.sessionId !== previousResult.sessionId) {
        workspace.saveResult(previousSnapshot, previousResult);
        window.setTimeout(() => {
          void history.persist(previousSnapshot, previousResult, previous.getInputs(), previous.getJudgments());
        }, 0);
      }
      await releaseRuntime();
      const nextAudio = new SessionAudio(next, () => {
        failure.value = 'audio-unavailable';
        stopInput();
        refreshState();
        stopFrame();
      });
      audio = nextAudio;
      const nextSnapshot = next.getSnapshot();
      requireCondition(nextSnapshot !== null, 'session.snapshot', 'Repeated session has no snapshot.');
      if (nextSnapshot.calibration.context.audioMode === 'enabled' && !await nextAudio.metronome.enable()) {
        throw new Error('audio-unavailable');
      }
      const nextContext = captureContext(
        nextSnapshot.calibration.context.audioMode,
        nextSnapshot.calibration.context.audioMode === 'enabled' ? nextAudio.metronome.sampleRateHz : null,
        nextSnapshot.calibration.context.audioMode === 'enabled' ? nextAudio.metronome.outputId : null,
        nextSnapshot.calibration.context.audioOutputLabel ?? '',
      );
      if (!matchesCalibration(nextSnapshot.calibration, nextSnapshot.device, nextContext)) {
        throw new Error('calibration-mismatch');
      }
      refreshDevices();
      adaptation.beginAttempt();
      activatePrepared(next, nextAudio);
    } catch (error) {
      if (next && !['idle', 'completed', 'aborted'].includes(next.getView().state)) next.abort('unrecoverable-error');
      session = previous;
      refreshState();
      failure.value = error instanceof Error && error.message === 'audio-unavailable'
        ? 'audio-unavailable' : error instanceof Error && error.message === 'calibration-mismatch'
          ? 'calibration-mismatch' : 'device-unavailable';
      await releaseRuntime();
    } finally {
      starting.value = false;
    }
  }

  function pause() {
    if (!session || !isActive.value) return;
    session.pause('user-pause');
    stopInput();
    audio?.synchronize();
    refreshState();
    stopFrame();
  }

  async function resume() {
    const target = session;
    if (!target || target.getView().state !== 'paused' || starting.value) return;
    starting.value = true;
    failure.value = null;
    try {
      const currentAudio = audio;
      if (snapshot.value?.calibration.context.audioMode === 'enabled') {
        if (!currentAudio || !await currentAudio.metronome.enable()) throw new Error('audio-unavailable');
        if (disposed || session !== target || target.getView().state !== 'paused') return;
      }
      stopInput();
      const nextInput = createInput(target);
      input = nextInput;
      target.resume();
      nextInput.start();
      if (!nextInput.capturing) throw new Error('device-unavailable');
      audio?.synchronize();
      refreshState();
      if (isActive.value) frame = requestAnimationFrame(animate);
    } catch (error) {
      stopInput();
      failure.value = error instanceof Error && error.message === 'audio-unavailable'
        ? 'audio-unavailable' : 'device-unavailable';
      refreshState();
    } finally {
      starting.value = false;
    }
  }

  async function leave() {
    operation++;
    starting.value = false;
    if (session && ['ready', 'countdown', 'running', 'paused'].includes(session.getView().state)) session.abort('user-exit');
    refreshState();
    await releaseRuntime();
  }

  function pageHidden(): void {
    if (!session || !['countdown', 'running'].includes(session.getView().state)) return;
    session.pause('page-hidden');
    stopInput();
    audio?.metronome.stop();
    refreshState();
    stopFrame();
  }

  async function reset() {
    await leave();
    session = null;
    clearAttemptState();
    failure.value = null;
  }

  async function applyRecommendation() {
    const config = await adaptation.accept();
    if (!config) return;
    await reset();
    loadConfig(config);
    saveDraft(config);
  }

  async function adjustRecommendation() {
    const config = await adaptation.adjust();
    if (!config) return;
    await reset();
    loadConfig(config);
    saveDraft(config);
  }

  async function ignoreRecommendation() {
    await adaptation.ignore();
  }

  watch(profileId, (id) => {
    calibrationId.value = null;
    if (ui.selectedProfileId !== id) ui.selectProfile(id);
    refreshDevices();
  }, { flush: 'sync' });
  watch(audioMode, () => { calibrationId.value = null; }, { flush: 'sync' });
  watch(focusSegment, (selected) => {
    if (!selected) return;
    try {
      const chart = generateDrill(buildBaseConfig());
      const notes = chart.notes.filter((note) => note.origin.repetition === 0
        && segmentKey(note.origin.segmentId) === selected);
      if (!notes.some((note) => note.durationTicks > 0)) requireFullSustains.value = false;
      if (!notes.some((note) => note.expectedStrumDirection !== null)) requireStrumDirection.value = false;
    } catch {
      // A prévia apresenta o erro canônico da configuração.
    }
  });
  watch(segmentOptions, (options) => {
    const selected = focusSegment.value;
    if (selected && !options.includes(selected)) focusSegment.value = null;
  });

  function updateSystemMotion(event: MediaQueryListEvent): void {
    systemReducedMotion.value = event.matches;
  }

  const requestedPreset = typeof route.query.preset === 'string' ? route.query.preset : null;
  const draftConfig = workspace.draftConfig;
  const draftPresetId = workspace.draftPresetId;
  if (requestedPreset) {
    if (getDrillPreset(requestedPreset)) selectPreset(requestedPreset);
  } else if (draftConfig && draftPresetId) {
    presetId.value = draftPresetId;
    loadConfig(draftConfig);
    focusSegment.value = workspace.draftFocusSegment;
    const draftContext = workspace.draftContext;
    if (draftContext) {
      mode.value = draftContext.mode;
      profileId.value = draftContext.profileId;
      audioMode.value = draftContext.audioMode;
      calibrationId.value = draftContext.calibrationId;
    }
  }

  onMounted(() => {
    motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    systemReducedMotion.value = motionQuery?.matches ?? false;
    motionQuery?.addEventListener('change', updateSystemMotion);
    discovery = new GamepadDiscovery();
    refreshDevices();
    discoveryTimer = setInterval(refreshDevices, 1000);
    window.addEventListener('pagehide', pageHidden);
  });
  onBeforeRouteLeave(async () => { await leave(); });
  onBeforeUnmount(() => {
    disposed = true;
    operation++;
    if (session && ['ready', 'countdown', 'running', 'paused'].includes(session.getView().state)) session.abort('user-exit');
    refreshState();
    stopFrame();
    stopInput();
    void audio?.dispose();
    audio = null;
    if (discoveryTimer !== null) clearInterval(discoveryTimer);
    discovery?.dispose();
    window.removeEventListener('pagehide', pageHidden);
    motionQuery?.removeEventListener('change', updateSystemMotion);
    motionQuery = null;
  });

  return {
    ui, workspace, history, adaptation, captureArea, profileId, profile, connectionId, matchingConnections,
    presetId, selectedPreset, technique, level, descriptor, mode, bpm, seed, subdivision, allowedFrets,
    lengthKind, lengthValue, automaticStrum, minimumAccuracy, maximumErrors, consistentAttempts,
    requireArticulation, requireStrumDirection, requireFullSustains, focusSegment, segmentOptions,
    audioMode, calibrationId, availableCalibrations, discoveryUnavailable, starting, failure,
    snapshot, view, evaluation, judgments, latestJudgment, result, presentation, configurationLocked,
    preview, requirements, compatibility, directionGoalAvailable, sustainGoalAvailable,
    durationMaximumBeats, judgmentCount,
    state, isActive, isPaused, isFinished, countdownBeat,
    resolvedNotes, progress, selectPreset, refreshDevices, startAttempt, pause, resume,
    restart: () => launchNext('restart'), repeat: () => launchNext('repeat'), vary: () => launchNext('vary'),
    applyRecommendation, adjustRecommendation, ignoreRecommendation, leave, reset,
  };
}
