<template>
  <PageFrame>
    <PageHeading :eyebrow="t('calibration.eyebrow')" :title="t('calibration.title')" :description="t('calibration.description')" />
    <FeedbackBanner :message="t('timing.intro')" />
    <section class="surface-card section-spacing">
      <div class="calibration-fields">
        <q-select :model-value="ui.selectedProfileId" :options="profileOptions" emit-value map-options :label="t('timing.profile')" :disable="busy" @update:model-value="ui.selectProfile" />
        <q-select v-if="device.kind !== 'keyboard'" v-model="connectionId" :options="connectionOptions" emit-value map-options :label="t('timing.connection')" :disable="busy" />
      </div>
      <p v-if="device.kind === 'gamepad'">{{ t(discoveryError ? 'input.unavailable' : 'input.discovery') }}</p>
      <p v-else-if="device.kind === 'webhid'">{{ t(hidDiscovery.available ? 'input.discoveryWebHid' : 'input.webHidUnavailable') }}</p>
      <q-btn flat no-caps :to="{ name: 'devices' }" :label="t('timing.devices')" />
      <q-option-group v-model="audioMode" :options="audioOptions" :disable="busy" inline color="primary" :aria-label="t('timing.audioMode')" />
      <template v-if="audioMode === 'enabled'">
        <q-input v-model="outputLabel" :maxlength="256" :label="t('timing.output')" :disable="busy" />
        <p>{{ t('timing.outputHelp') }}</p>
        <q-btn outline no-caps :disable="busy" :label="t('timing.enable')" @click="prepareAudio" />
        <span v-if="audioReady" class="q-ml-md" role="status">{{ t('timing.ready') }}</span>
        <p v-if="audioReady && outputId === null">{{ t('timing.unidentified') }}</p>
        <q-checkbox v-model="outputConfirmed" :disable="busy || !audioReady" :label="t('timing.confirmOutput')" />
      </template>
      <FeedbackBanner v-else class="q-mt-md" :message="t('timing.silentNotice')" />
    </section>

    <section class="surface-card section-spacing">
      <p>{{ t(matching ? 'timing.matching' : 'timing.missing') }}</p>
      <q-btn outline no-caps :disable="busy || !contextReady || !matching" :label="t('timing.load')" @click="loadSaved" />
      <div class="calibration-fields q-mt-md">
        <div>
          <q-input v-model.number="judgmentOffset" type="number" min="-1000" max="1000" step="1" :label="t('timing.judgment')" :disable="busy" @update:model-value="manualChange" />
          <p>{{ t('timing.judgmentHelp') }}</p>
        </div>
        <div>
          <q-input v-model.number="visualOffset" type="number" min="-1000" max="1000" step="1" :label="t('timing.visual')" :disable="busy" @update:model-value="manualChange" />
          <p>{{ t('timing.visualHelp') }}</p>
        </div>
      </div>
      <div class="row q-gutter-sm">
        <q-btn color="primary" no-caps :disable="busy || !contextReady" :label="t('timing.save')" @click="saveAdjustment(false)" />
        <q-btn outline no-caps :disable="busy || !contextReady" :label="t('timing.reset')" @click="saveAdjustment(true)" />
      </div>
      <FeedbackBanner
        v-if="message === 'saved' || message === 'restored'"
        class="q-mt-md"
        :message="messageText"
      />
    </section>

    <section class="surface-card section-spacing">
      <p>{{ t('timing.instructions') }}</p>
      <div class="row q-gutter-sm q-mb-md">
        <q-btn color="primary" no-caps :disable="busy || audioMode === 'silent' || !contextReady" :label="t('timing.guide')" @click="startRound(true)" />
        <q-btn outline no-caps :disable="busy || !contextReady" :label="t('timing.preview')" @click="startRound(false)" />
        <q-btn outline no-caps :disable="!busy" :label="t('timing.stop')" @click="interruptRound()" />
      </div>
      <p role="status">{{ runMessage }}</p>
      <div ref="captureArea" class="calibration-capture" tabindex="0" :aria-label="t('timing.capture')">
        <div class="pulse" :class="{ 'pulse--on': pulse }" aria-hidden="true"></div>
        <p>{{ t('timing.capture') }}</p>
      </div>
      <p v-if="estimate" role="status">{{ t('timing.estimate', { offset: estimate.offsetMs, count: estimate.sampleCount, rejected: estimate.rejected, mad: estimate.madMs }) }}</p>
    </section>

    <FeedbackBanner
      v-if="message && message !== 'saved' && message !== 'restored'"
      class="section-spacing"
      :message="messageText"
      tone="error"
    />
    <FeedbackBanner class="section-spacing" :message="storageMessage" :tone="calibrations.storageStatus === 'saved' ? 'info' : 'error'">
      <template v-if="calibrations.storageStatus === 'memory'" #actions>
        <q-btn flat no-caps :label="t('timing.retry')" @click="calibrations.retryStorage()" />
      </template>
    </FeedbackBanner>
    <p class="section-spacing">{{ t('timing.pending') }}</p>
  </PageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CalibrationProfile, DeviceProfile } from '@/engine/domain';
import { visualTime } from '@/engine/timing/calibrated-time';
import { sameReference } from '@/engine/domain/validation';
import { useInterfaceStore } from '@/stores/interface';
import { useCalibrationStore } from '@/stores/calibration';
import { BrowserInputAdapter, DEFAULT_KEYBOARD, GamepadDiscovery, WebHidDiscovery,
  type GamepadConnection, type WebHidConnection } from '@/platform/input';
import { Metronome } from '@/platform/audio/metronome';
import { GUIDED, GuidedCalibration, type CalibrationEstimate } from '@/platform/calibration/guided';
import { captureContext, createCalibration, matchesCalibration } from '@/platform/calibration/profiles';
import { normalizeInputTime } from '@/platform/timing/session-clock';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';

const { t } = useI18n();
const ui = useInterfaceStore();
const calibrations = useCalibrationStore();
const device = computed(() => ui.profiles.find((profile) => profile.id === ui.selectedProfileId) ?? DEFAULT_KEYBOARD);
const profileOptions = computed(() => ui.profiles.map((profile) => ({ value: profile.id, label: profile.label })));
const connections = shallowRef<readonly GamepadConnection[]>([]);
const hidConnections = shallowRef<readonly WebHidConnection[]>([]);
const matchingConnections = computed(() => connections.value.filter((connection) => connection.hardwareId === device.value.hardwareId));
const matchingHidConnections = computed(() => hidConnections.value.filter((connection) => connection.hardwareId === device.value.hardwareId));
const selectedConnection = computed(() => {
  const selection = ui.selectedGamepad;
  return selection ? matchingConnections.value.find((connection) =>
    connection.index === selection.index && connection.hardwareId === selection.hardwareId) : undefined;
});
const selectedHidConnection = computed(() => {
  const selection = ui.selectedWebHid;
  return selection ? matchingHidConnections.value.find((connection) => connection.connectionId === selection.connectionId
    && connection.hardwareId === selection.hardwareId) : undefined;
});
const connectionId = computed({
  get: () => device.value.kind === 'webhid' ? selectedHidConnection.value?.connectionId ?? null : selectedConnection.value?.connectionId ?? null,
  set: (id: string | null) => device.value.kind === 'webhid'
    ? ui.selectWebHid(matchingHidConnections.value.find((connection) => connection.connectionId === id) ?? null)
    : ui.selectGamepad(matchingConnections.value.find((connection) => connection.connectionId === id) ?? null),
});
const connectionOptions = computed(() => (device.value.kind === 'webhid' ? matchingHidConnections.value : matchingConnections.value)
  .map((connection) => ({ value: connection.connectionId,
    label: `${'index' in connection ? connection.index + 1 + ' · ' : ''}${connection.recognition.productName ?? connection.hardwareId}` })));
const discoveryError = ref(false);
const initialCalibration = latestCalibration(device.value);
const audioMode = ref<'enabled' | 'silent'>(initialCalibration?.context.audioMode ?? 'enabled');
const audioOptions = computed(() => [{ label: t('timing.enabled'), value: 'enabled' }, { label: t('timing.silent'), value: 'silent' }]);
const outputLabel = ref(initialCalibration?.context.audioOutputLabel ?? '');
const outputConfirmed = ref(false);
const outputId = ref<string | null>(null);
const sampleRate = ref<number | null>(null);
const audioReady = ref(false);
const context = computed(() => captureContext(audioMode.value, sampleRate.value, outputId.value, outputLabel.value));
const contextReady = computed(() => audioMode.value === 'silent' || (audioReady.value && outputConfirmed.value));
const matching = computed(() => calibrations.records.find((record) => matchesCalibration(record, device.value, context.value)));
const judgmentOffset = ref<number | string | null>(initialCalibration?.judgmentOffsetMs ?? 0);
const visualOffset = ref<number | string | null>(initialCalibration?.visualOffsetMs ?? 0);
const method = ref<CalibrationProfile['method']>(initialCalibration?.method ?? 'default');
const savedSampleCount = ref(initialCalibration?.sampleCount ?? 0);
const estimate = shallowRef<CalibrationEstimate | null>(null);
const state = ref<'idle' | 'starting' | 'running'>('idle');
const busy = computed(() => state.value !== 'idle');
const guided = ref(false);
const sampleCount = ref(0);
const startAt = ref(0);
const displayNow = ref(0);
const captureArea = ref<HTMLElement | null>(null);
const message = ref<'unavailable' | 'changed' | 'insufficient' | 'interrupted' | 'range' | 'storageLimit' | 'saved' | 'restored' | 'mismatch' | null>(initialCalibration ? 'restored' : null);
const messageText = computed(() => {
  if (message.value === 'saved' || message.value === 'restored') {
    return t(`timing.${message.value}`, {
      input: formatOffset(judgmentOffset.value), visual: formatOffset(visualOffset.value),
    });
  }
  return message.value ? t(`timing.${message.value}`) : '';
});
const phase = computed(() => visualTime(displayNow.value - startAt.value, { visualOffsetMs: guided.value ? 0 : Number(visualOffset.value) }) / (60_000 / GUIDED.bpm));
const pulse = computed(() => state.value === 'running' && phase.value >= 0 && phase.value < 20 && phase.value % 1 < 0.15);
const runMessage = computed(() => state.value === 'starting' ? t('timing.starting') : state.value === 'idle' ? t('timing.idle')
  : !guided.value ? t('timing.previewing') : displayNow.value < startAt.value + GUIDED.countdown * 60_000 / GUIDED.bpm
    ? t('timing.countIn', { count: Math.max(0, GUIDED.countdown - Math.max(0, Math.floor((displayNow.value - startAt.value) / (60_000 / GUIDED.bpm)))) })
    : t('timing.collecting', { count: sampleCount.value }));
const storageMessage = computed(() => t(calibrations.storageStatus === 'memory' ? 'timing.storageMemory'
  : calibrations.storageStatus === 'incompatible' ? 'timing.storageIncompatible'
    : calibrations.records.length ? 'timing.storageSaved' : 'timing.storageEmpty'));

let discovery: GamepadDiscovery | null = null;
const hidDiscovery = new WebHidDiscovery();
let discoveryTimer: ReturnType<typeof setInterval> | null = null;
let frame: number | null = null;
let tailTimer: ReturnType<typeof setTimeout> | null = null;
let input: BrowserInputAdapter | null = null;
let collector: GuidedCalibration | null = null;
let operation = 0;
let disposed = false;
let restoringSelection = false;
const metronome = new Metronome((reason) => {
  audioReady.value = false; outputConfirmed.value = false;
  if (reason === 'context-changed') resetContextAdjustment();
  interruptRound(reason === 'context-changed' ? 'changed' : 'unavailable');
});

function refreshDevices() {
  if (document.hidden) return;
  try {
    connections.value = discovery?.list() ?? [];
    discoveryError.value = false;
    if (!selectedConnection.value && matchingConnections.value.length === 1) {
      ui.selectGamepad(matchingConnections.value[0] ?? null);
    }
  }
  catch { connections.value = []; discoveryError.value = true; }
}

async function refreshHidDevices() {
  if (document.hidden || !hidDiscovery.available) return;
  try {
    hidConnections.value = await hidDiscovery.list();
    if (!selectedHidConnection.value && matchingHidConnections.value.length === 1) {
      ui.selectWebHid(matchingHidConnections.value[0] ?? null);
    }
  } catch { hidConnections.value = []; }
}

function stopRound() {
  operation++;
  input?.dispose(); input = null;
  metronome.stop();
  if (frame !== null) cancelAnimationFrame(frame);
  if (tailTimer !== null) clearTimeout(tailTimer);
  tailTimer = null;
  frame = null; collector = null; state.value = 'idle';
}

function interruptRound(reason: 'changed' | 'unavailable' | 'interrupted' | 'insufficient' = 'interrupted') {
  stopRound(); estimate.value = null; sampleCount.value = 0;
  message.value = reason;
}

function latestCalibration(target: DeviceProfile, mode?: 'enabled' | 'silent'): CalibrationProfile | undefined {
  return calibrations.records
    .filter((record) => sameReference(record.deviceProfile, target) && (mode === undefined || record.context.audioMode === mode))
    .reduce<CalibrationProfile | undefined>((latest, record) =>
      !latest || record.createdAtIso > latest.createdAtIso ? record : latest, undefined);
}

function applySavedCalibration(profile: CalibrationProfile) {
  judgmentOffset.value = profile.judgmentOffsetMs; visualOffset.value = profile.visualOffsetMs;
  method.value = profile.method; savedSampleCount.value = profile.sampleCount; estimate.value = null;
}

function restoreSelectionCalibration() {
  stopRound(); outputConfirmed.value = false; resetContextAdjustment();
  const saved = latestCalibration(device.value, audioMode.value);
  restoringSelection = true;
  outputLabel.value = saved?.context.audioOutputLabel ?? '';
  restoringSelection = false;
  if (saved) applySavedCalibration(saved);
  message.value = saved ? 'restored' : 'changed';
}

function formatOffset(value: number | string | null): string {
  const offset = Number(value);
  return offset > 0 ? `+${offset}` : String(offset);
}

async function prepareAudio() {
  stopRound(); state.value = 'starting'; message.value = null;
  const token = operation;
  const enabled = await metronome.enable();
  if (disposed || token !== operation) return;
  audioReady.value = enabled;
  if (sampleRate.value !== metronome.sampleRateHz || outputId.value !== metronome.outputId) resetContextAdjustment();
  sampleRate.value = metronome.sampleRateHz; outputId.value = metronome.outputId;
  outputConfirmed.value = false;
  state.value = 'idle';
  if (!enabled) message.value = 'unavailable';
  else {
    const saved = calibrations.records.find((record) => matchesCalibration(record, device.value, context.value));
    if (saved) applySavedCalibration(saved);
    message.value = saved ? 'restored' : 'changed';
    try { metronome.audition(); }
    catch { audioReady.value = false; message.value = 'unavailable'; }
  }
}

function manualChange() { estimate.value = null; method.value = 'manual'; savedSampleCount.value = 0; }
function validOffset(value: number | string | null): boolean {
  return value !== null && String(value).trim() !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 1000;
}
function resetContextAdjustment() {
  estimate.value = null; judgmentOffset.value = 0; visualOffset.value = 0;
  method.value = 'default'; savedSampleCount.value = 0;
}
function loadSaved() {
  if (!contextReady.value || !matching.value) return;
  applySavedCalibration(matching.value);
  message.value = 'restored';
}
function saveAdjustment(reset: boolean) {
  if (!contextReady.value || busy.value) return;
  try {
    if (!reset && (!validOffset(judgmentOffset.value) || !validOffset(visualOffset.value))) throw new Error('Invalid offset');
    const profile = createCalibration(device.value, context.value, reset ? 'default' : method.value,
      reset ? 0 : Number(judgmentOffset.value), reset ? 0 : Number(visualOffset.value), reset ? 0 : savedSampleCount.value);
    try { calibrations.save(profile); } catch { message.value = 'storageLimit'; return; }
    applySavedCalibration(profile);
    if (reset) estimate.value = null;
    message.value = 'saved';
  } catch { message.value = 'range'; }
}

function finishRound() {
  const result = collector;
  const wasGuided = guided.value;
  stopRound();
  if (!wasGuided || !result) return;
  try {
    estimate.value = result.estimate();
    judgmentOffset.value = estimate.value.offsetMs; savedSampleCount.value = estimate.value.sampleCount;
    method.value = 'guided-combined'; message.value = null;
  } catch { estimate.value = null; message.value = 'insufficient'; }
}

async function startRound(isGuided: boolean) {
  if (!contextReady.value || (isGuided && audioMode.value === 'silent') || !captureArea.value) return;
  stopRound(); message.value = null; guided.value = isGuided; estimate.value = null; sampleCount.value = 0;
  state.value = 'starting';
  const token = operation;
  if (audioMode.value === 'enabled' && !await metronome.enable()) {
    audioReady.value = false; outputConfirmed.value = false; interruptRound('unavailable'); return;
  }
  if (disposed || token !== operation) return;
  state.value = 'idle';
  refreshDevices(); await refreshHidDevices();
  const connection = selectedConnection.value;
  if (isGuided && device.value.kind === 'gamepad' && (!connection || connection.hardwareId !== device.value.hardwareId)) { message.value = 'mismatch'; return; }
  const hid = selectedHidConnection.value;
  if (isGuided && device.value.kind === 'webhid' && (!hid || hid.hardwareId !== device.value.hardwareId)) { message.value = 'mismatch'; return; }
  if (!validOffset(visualOffset.value)) { message.value = 'range'; return; }
  if (isGuided && hid) {
    try { await hidDiscovery.open(hid); }
    catch { interruptRound('unavailable'); return; }
  }
  if (disposed || token !== operation) return;
  startAt.value = performance.now() + 300;
  displayNow.value = performance.now();
  if (isGuided) { collector = new GuidedCalibration(startAt.value); method.value = 'manual'; savedSampleCount.value = 0; }
  state.value = 'running';
  captureArea.value.focus({ preventScroll: true });
  captureArea.value.scrollIntoView({ block: 'center' });
  try {
    if (isGuided) {
      let horizon = 0;
      input = new BrowserInputAdapter({ profile: device.value, scope: captureArea.value,
        ...(device.value.kind === 'gamepad' && connection ? { gamepad: connection } : {}),
        ...(device.value.kind === 'webhid' && hid ? { webhid: hid } : {}),
        timeline: { sample(observed, stamp) {
          const normalized = normalizeInputTime(observed, stamp, performance.timeOrigin, (wall) => wall, horizon);
          horizon = normalized.sessionTimeMs; return normalized;
        } },
        onBaseline() {},
        onEvent(event) {
          if ((event.strum === null && event.pressedFrets === 0) || !collector) return;
          try { collector.tap(event.sessionTimeMs); sampleCount.value = collector.sampleCount; }
          catch { interruptRound('insufficient'); }
        },
        onInterrupt() { interruptRound(); },
      });
      input.start();
      if (!input?.capturing) { interruptRound(); return; }
    }
    metronome.start({ bpm: GUIDED.bpm, beats: GUIDED.countdown + GUIDED.samples,
      startAtMs: startAt.value, silent: audioMode.value === 'silent', onEnd() {
        if (!isGuided && Number(visualOffset.value) > 0) tailTimer = setTimeout(finishRound, Number(visualOffset.value));
        else finishRound();
      },
    });
    animate();
  } catch { interruptRound('unavailable'); }
}

function animate() {
  if (state.value !== 'running') return;
  displayNow.value = performance.now();
  frame = requestAnimationFrame(animate);
}
function lostFocus() { if (busy.value) interruptRound(); }
function hidden() { if (document.hidden) lostFocus(); }
function contextChanged() { outputConfirmed.value = false; audioReady.value = false; resetContextAdjustment(); interruptRound('changed'); }
function focusLeft(event: FocusEvent) {
  if (event.relatedTarget instanceof Node && captureArea.value?.contains(event.relatedTarget)) return;
  if (busy.value) interruptRound();
}

watch([device, audioMode], restoreSelectionCalibration);
watch(outputLabel, () => {
  if (restoringSelection) return;
  stopRound(); outputConfirmed.value = false; resetContextAdjustment();
  const saved = calibrations.records.find((record) => matchesCalibration(record, device.value, context.value));
  if (saved) applySavedCalibration(saved);
  message.value = saved ? 'restored' : 'changed';
}, { flush: 'sync' });
watch(connectionId, () => { if (busy.value) interruptRound('changed'); outputConfirmed.value = false; });
onMounted(() => {
  discovery = new GamepadDiscovery(); refreshDevices(); void refreshHidDevices(); discoveryTimer = setInterval(() => {
    refreshDevices(); void refreshHidDevices();
  }, 1000);
  window.addEventListener('blur', lostFocus); document.addEventListener('visibilitychange', hidden);
  navigator.mediaDevices?.addEventListener('devicechange', contextChanged);
  captureArea.value?.addEventListener('focusout', focusLeft);
});
onBeforeUnmount(() => {
  disposed = true; stopRound(); void metronome.dispose();
  discovery?.dispose(); hidDiscovery.dispose(); if (discoveryTimer !== null) clearInterval(discoveryTimer);
  window.removeEventListener('blur', lostFocus); document.removeEventListener('visibilitychange', hidden);
  navigator.mediaDevices?.removeEventListener('devicechange', contextChanged);
  captureArea.value?.removeEventListener('focusout', focusLeft);
});
</script>

<style scoped>
.calibration-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.calibration-capture { padding: 1.5rem; border: 2px dashed var(--fs-border); border-radius: 12px; text-align: center; }
.calibration-capture:focus { outline: 3px solid var(--q-primary); outline-offset: 3px; }
.pulse { width: 72px; height: 72px; margin: auto; border: 4px solid var(--fs-muted); border-radius: 50%; }
.pulse--on { background: var(--fs-accent); border-color: var(--fs-accent); }
@media (max-width: 700px) { .calibration-fields { grid-template-columns: 1fr; } }
</style>
