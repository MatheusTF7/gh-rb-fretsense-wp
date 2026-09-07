import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type {
  Articulation, CalibrationProfile, DrillConfig, JudgmentEvent, SessionResult, SessionSnapshot,
} from '@/engine/domain';
import { parseDrillConfig } from '@/engine/domain/configuration';
import { FRETSENSE_V1_RULE_PROFILE } from '@/engine/domain/rules';
import { sameReference } from '@/engine/domain/validation';
import { ASCENDING_DESCENDING_PATTERN, REPEATED_STRUM_PATTERN } from '@/engine/generation';
import { TrainingSession, type SessionEvaluation, type SessionView } from '@/engine/session';
import { SessionAudio } from '@/platform/audio/session-audio';
import { captureContext, createCalibration, matchesCalibration } from '@/platform/calibration/profiles';
import {
  createSessionInput, DEFAULT_KEYBOARD, GamepadDiscovery,
  type BrowserInputAdapter, type GamepadConnection, type InputInterruption,
} from '@/platform/input';
import { SessionClock } from '@/platform/timing/session-clock';
import { useCalibrationStore } from '@/stores/calibration';
import { useInterfaceStore } from '@/stores/interface';

export type PlayFailure =
  | 'audio-unavailable'
  | 'calibration-mismatch'
  | 'configuration-invalid'
  | 'device-unavailable'
  | 'input-interrupted';

const EMPTY_VIEW: SessionView = Object.freeze({
  state: 'idle', sessionId: null, activeTimeMs: 0, countdownRemainingMs: 0,
  activeFrets: 0, inputCount: 0, result: null,
});

let identitySequence = 0;
function identity() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${++identitySequence}`;
}

export function useTrainingSession() {
  const ui = useInterfaceStore();
  const calibrations = useCalibrationStore();
  const captureArea = ref<HTMLElement | null>(null);
  const profileId = ref(ui.selectedProfileId);
  const patternId = ref<'ascending-descending' | 'repeated-strum'>('ascending-descending');
  const articulation = ref<Extract<Articulation, 'strum' | 'tap'>>('strum');
  const automaticStrum = ref(true);
  const chordSize = ref<1 | 2 | 3>(1);
  const bpm = ref<number | string | null>(120);
  const repetitions = ref<number | string | null>(4);
  const audioMode = ref<'enabled' | 'silent'>('enabled');
  const calibrationId = ref<string | null>(null);
  const connections = shallowRef<readonly GamepadConnection[]>([]);
  const discoveryUnavailable = ref(false);
  const starting = ref(false);
  const failure = ref<PlayFailure | null>(null);
  const snapshot = shallowRef<SessionSnapshot | null>(null);
  const view = shallowRef<SessionView>(EMPTY_VIEW);
  const evaluation = shallowRef<SessionEvaluation | null>(null);
  const judgments = shallowRef<readonly JudgmentEvent[]>(Object.freeze([]));
  const latestJudgment = shallowRef<JudgmentEvent | null>(null);
  const result = shallowRef<SessionResult | null>(null);

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

  function buildConfig(): DrillConfig {
    const ascending = patternId.value === 'ascending-descending';
    const chosenArticulation = ascending ? articulation.value : 'strum';
    const chosenChordSize = ascending ? 1 : chordSize.value;
    return parseDrillConfig({
      schemaVersion: 1,
      technique: ascending ? chosenArticulation === 'tap' ? 'tapping' : 'sequences'
        : chosenChordSize === 1 ? 'single-strum' : 'chords',
      level: 'beginner',
      pattern: ascending ? ASCENDING_DESCENDING_PATTERN : REPEATED_STRUM_PATTERN,
      bpm: Number(bpm.value), subdivision: 2, allowedFrets: 31,
      patternLength: ascending ? 10 : 4,
      length: { kind: 'repetitions', count: Number(repetitions.value) },
      articulation: chosenArticulation, automaticStrum: automaticStrum.value, chordSize: chosenChordSize,
      sustainTicks: 0, strumDirectionGoal: { kind: 'none' },
      goals: {
        minimumAccuracy: 0.9, maximumErrors: 4, consistentAttempts: 3,
        requireArticulation: true, requireStrumDirection: false, requireFullSustains: false,
      },
      seed: `playable-v1:${patternId.value}:${chosenArticulation}:${chosenChordSize}`,
      ruleProfile: FRETSENSE_V1_RULE_PROFILE,
    });
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
    const context = captureContext(
      audioMode.value,
      audioMode.value === 'enabled' ? sessionAudio.metronome.sampleRateHz : null,
      audioMode.value === 'enabled' ? sessionAudio.metronome.outputId : null,
      '',
    );
    return createCalibration(profile.value, context, 'default');
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
    if (count !== judgments.value.length) {
      judgments.value = session.getJudgments();
      latestJudgment.value = judgments.value.at(-1) ?? null;
    }
    if (view.value.state === 'paused' || view.value.state === 'completed' || view.value.state === 'aborted') {
      stopFrame();
      stopInput();
      audio?.metronome.stop();
    }
  }

  function animate() {
    frame = null;
    if (!session || (session.getView().state !== 'countdown' && session.getView().state !== 'running')) return;
    session.advance();
    audio?.synchronize();
    refreshState();
    if (session.getView().state === 'countdown' || session.getView().state === 'running') {
      frame = requestAnimationFrame(animate);
    }
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
    if (!scope) throw new Error('capture-unavailable');
    const connection = selectedConnection.value;
    if (profile.value.kind === 'gamepad' && !connection) throw new Error('device-unavailable');
    return createSessionInput(target, {
      scope,
      ...(profile.value.kind === 'gamepad' && connection ? { gamepad: connection } : {}),
    }, inputInterrupted, { onEvent: refreshState, onBaseline: refreshState });
  }

  async function startAttempt() {
    const token = ++operation;
    starting.value = true;
    failure.value = null;
    if (session && ['ready', 'countdown', 'running', 'paused'].includes(session.getView().state)) {
      session.abort('restart');
    }
    session = null;
    snapshot.value = null;
    view.value = EMPTY_VIEW;
    evaluation.value = null;
    judgments.value = Object.freeze([]);
    latestJudgment.value = null;
    result.value = null;
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
      if (audioMode.value === 'enabled' && !await nextAudio.metronome.enable()) {
        throw new Error('audio-unavailable');
      }
      if (disposed || token !== operation) {
        await nextAudio.dispose();
        return;
      }
      refreshDevices();
      if (profile.value.kind === 'gamepad' && !selectedConnection.value) throw new Error('device-unavailable');
      const config = buildConfig();
      const calibration = resolveCalibration(nextAudio);
      next.prepare({ mode: 'practice', config, device: profile.value, calibration });
      next.enableInitialJudgment();
      session = next;
      snapshot.value = next.getSnapshot();
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
    } catch (error) {
      if (next.getView().state !== 'idle' && next.getView().state !== 'completed' && next.getView().state !== 'aborted') {
        next.abort('unrecoverable-error');
      }
      session = null;
      snapshot.value = null;
      view.value = EMPTY_VIEW;
      evaluation.value = null;
      judgments.value = Object.freeze([]);
      latestJudgment.value = null;
      result.value = null;
      failure.value = error instanceof Error && error.message === 'audio-unavailable' ? 'audio-unavailable'
        : error instanceof Error && error.message === 'device-unavailable' ? 'device-unavailable'
          : error instanceof Error && error.message === 'calibration-mismatch' ? 'calibration-mismatch'
            : 'configuration-invalid';
      await releaseRuntime();
    } finally {
      if (token === operation) starting.value = false;
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
        if (!currentAudio) throw new Error('audio-unavailable');
        const enabled = await currentAudio.metronome.enable();
        if (disposed || session !== target || target.getView().state !== 'paused') return;
        if (!enabled) throw new Error('audio-unavailable');
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
    if (session && ['ready', 'countdown', 'running', 'paused'].includes(session.getView().state)) {
      session.abort('user-exit');
    }
    await releaseRuntime();
  }

  async function reset() {
    await leave();
    session = null;
    snapshot.value = null;
    view.value = EMPTY_VIEW;
    evaluation.value = null;
    judgments.value = Object.freeze([]);
    latestJudgment.value = null;
    result.value = null;
    failure.value = null;
  }

  watch(profileId, (id) => {
    calibrationId.value = null;
    if (ui.selectedProfileId !== id) ui.selectProfile(id);
    refreshDevices();
  });
  watch(audioMode, () => { calibrationId.value = null; });
  watch(patternId, (pattern) => {
    if (pattern === 'ascending-descending') chordSize.value = 1;
    else articulation.value = 'strum';
  });

  onMounted(() => {
    discovery = new GamepadDiscovery();
    refreshDevices();
    discoveryTimer = setInterval(refreshDevices, 1000);
  });
  onBeforeUnmount(() => {
    disposed = true;
    operation++;
    if (session && ['ready', 'countdown', 'running', 'paused'].includes(session.getView().state)) {
      session.abort('user-exit');
    }
    stopFrame();
    stopInput();
    void audio?.dispose();
    audio = null;
    if (discoveryTimer !== null) clearInterval(discoveryTimer);
    discovery?.dispose();
  });

  return {
    ui, calibrations, captureArea, profileId, profile, connectionId, matchingConnections,
    patternId, articulation, automaticStrum, chordSize, bpm, repetitions, audioMode, calibrationId,
    availableCalibrations, discoveryUnavailable, starting, failure, snapshot, view,
    evaluation, judgments, latestJudgment, result, configurationLocked, state, isActive,
    isPaused, isFinished, countdownBeat, resolvedNotes, progress,
    refreshDevices, startAttempt, pause, resume, restart: startAttempt, repeat: startAttempt, leave, reset,
  };
}
