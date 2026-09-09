<template>
  <PageFrame>
    <PageHeading :eyebrow="t('devices.eyebrow')" :title="t('devices.title')" :description="t('devices.description')" />
    <FeedbackBanner :message="t('input.notice')" />
    <section class="surface-card section-spacing">
      <div class="device-fields">
        <q-select :model-value="savedDraftId" :options="profileOptions" emit-value map-options :label="t('input.profile')" :disable="capturing" @update:model-value="selectProfile" />
        <q-select v-model="connectionId" :options="connectionOptions" emit-value map-options :label="t('input.connection')" :disable="capturing" />
        <q-select v-if="webHidSupported && draft.kind !== 'webhid'" v-model="hidConnectionId" :options="hidConnectionOptions" emit-value map-options
          :label="t('input.webHidConnection')" :disable="capturing" />
      </div>
      <p>{{ t('input.discovery') }}</p>
      <p v-if="discoveryError" role="status">{{ t('input.unavailable') }}</p>
      <p v-else-if="connections.length === 0">{{ t('input.noGamepads') }}</p>
      <div class="row q-gutter-sm">
        <q-btn outline no-caps :label="t('input.refresh')" :disable="capturing" @click="refreshAllDevices" />
        <q-btn outline no-caps :label="t('input.newGamepad')" :disable="capturing || !selectedConnection" @click="newGamepadProfile" />
        <q-btn outline no-caps icon="usb" :label="t('input.authorizeWebHid')" :disable="capturing || !webHidSupported" @click="authorizeWebHid" />
        <q-btn outline no-caps :label="t('input.newWebHid')" :disable="capturing || !selectedHidConnection" @click="newWebHidProfile" />
      </div>
      <p class="muted-text">{{ t(webHidSupported ? 'input.webHidPermission' : 'input.webHidUnavailable') }}</p>
      <p v-if="draft.recognition.category === 'guitar'" class="device-recognition">
        {{ t('input.guitarIdentified', { family: recognitionLabel(draft.recognition) }) }}
      </p>
      <p>{{ t('input.deviceIdentity', {
        transport: t('input.transport.' + draft.kind),
        product: draft.recognition.productName ?? t('input.unreported'),
      }) }}</p>
      <p v-if="draft.recognition.vendorId !== null && draft.recognition.productId !== null" class="muted-text">
        {{ t('input.usbIdentity', { vendor: hexId(draft.recognition.vendorId), product: hexId(draft.recognition.productId) }) }}
      </p>
      <q-input v-model="label" :maxlength="128" :label="t('input.label')" :disable="capturing" class="q-mt-md" />
      <p>{{ t('input.draft') }}</p>
      <q-btn color="primary" no-caps :label="t('input.save')" :disable="capturing" @click="saveProfile" />
    </section>
    <div class="section-spacing"><StorageNotice /></div>
    <FeedbackBanner v-if="message" class="section-spacing" :message="t('input.' + message)" :tone="message === 'savedProfile' ? 'info' : 'error'" />
    <section class="surface-card section-spacing">
      <div class="row q-gutter-sm q-mb-md">
        <q-btn color="primary" no-caps :disable="capturing" :label="t('input.start')" @click="beginCapture()" />
        <q-btn outline no-caps :disable="!capturing" :label="t('input.stop')" @click="stopCapture" />
      </div>
      <p role="status">{{ captureMessage }}</p>
      <div ref="captureArea" tabindex="0" class="capture-area" :aria-label="t('input.capture')">
        <InputMonitor :mask="mask" :strums="strums" :last-strum="lastStrum" />
      </div>
    </section>
    <MappingBindings :profile="draft" :capturing="capturing" @assign="beginCapture" @remove="removeMapping" />
    <section class="surface-card section-spacing">
      <h2>{{ t('input.capability') }}</h2>
      <p>{{ t(draft.capabilities.strum === 'directional' ? 'input.directional' : draft.capabilities.strum === 'undirected' ? 'input.undirected' : 'input.noStrum') }}</p>
      <p>{{ draft.capabilities.maximumSimultaneousFrets === null ? t('input.capacity') : t('input.capacityKnown', { count: draft.capabilities.maximumSimultaneousFrets }) }}</p>
      <h3>{{ t('input.chords') }}</h3>
      <p>{{ draft.capabilities.confirmedChords.length ? draft.capabilities.confirmedChords.map(maskLabel).join(' · ') : t('input.noChords') }}</p>
      <p>{{ t('input.chordHelp') }}</p>
      <h3>{{ t('input.extra') }}</h3>
      <p class="extra-controls">{{ draft.capabilities.distinguishableExtraControls.join(' · ') || t('input.noExtra') }}</p>
    </section>
    <section class="surface-card inline-card section-spacing">
      <div><h2>{{ t('devices.calibrationTitle') }}</h2><p>{{ t('devices.calibrationDescription') }}</p></div>
      <q-btn outline no-caps :to="{ name: 'calibration' }" :label="t('common.viewCalibration')" />
    </section>
  </PageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DeviceProfile, FretMask, InputAction, InputControl, NormalizedInputEvent, NoteFrets } from '@/engine/domain';
import { FRET_BITS } from '@/engine/domain/music';
import { countFrets } from '@/engine/domain/validation';
import { parseDeviceProfile } from '@/engine/session/snapshot';
import { BrowserInputAdapter, DEFAULT_KEYBOARD, GamepadDiscovery, WebHidDiscovery, actionId, controlId,
  recognitionLabel, validateMapping, webHidAvailable, withBindings, type GamepadConnection, type WebHidConnection } from '@/platform/input';
import { useInterfaceStore } from '@/stores/interface';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';
import StorageNotice from '@/components/StorageNotice.vue';
import MappingBindings from '@/components/devices/MappingBindings.vue';
import InputMonitor from '@/components/devices/InputMonitor.vue';

const { t } = useI18n();
const ui = useInterfaceStore();
const draft = shallowRef<DeviceProfile>(ui.profiles.find((profile) => profile.id === ui.selectedProfileId) ?? DEFAULT_KEYBOARD);
const label = ref(draft.value.label);
const connections = shallowRef<readonly GamepadConnection[]>([]);
const hidConnections = shallowRef<readonly WebHidConnection[]>([]);
const selectedConnection = computed(() => {
  const selection = ui.selectedGamepad;
  return selection ? connections.value.find((connection) =>
    connection.index === selection.index && connection.hardwareId === selection.hardwareId) : undefined;
});
const selectedHidConnection = computed(() => {
  const selection = ui.selectedWebHid;
  return selection ? hidConnections.value.find((connection) => connection.connectionId === selection.connectionId
    && connection.hardwareId === selection.hardwareId) : undefined;
});
const hidConnectionId = computed({
  get: () => selectedHidConnection.value?.connectionId ?? null,
  set: (id: string | null) => ui.selectWebHid(hidConnections.value.find((connection) => connection.connectionId === id) ?? null),
});
const connectionId = computed({
  get: () => draft.value.kind === 'webhid' ? selectedHidConnection.value?.connectionId ?? null : selectedConnection.value?.connectionId ?? null,
  set: (id: string | null) => draft.value.kind === 'webhid'
    ? ui.selectWebHid(hidConnections.value.find((connection) => connection.connectionId === id) ?? null)
    : ui.selectGamepad(connections.value.find((connection) => connection.connectionId === id) ?? null),
});
const profileOptions = computed(() => ui.profiles.map((profile) => ({ value: profile.id, label: profile.label })));
const savedDraftId = computed(() => ui.profiles.some((profile) => profile.id === draft.value.id) ? draft.value.id : null);
const connectionOptions = computed(() => draft.value.kind === 'webhid'
  ? hidConnections.value.map((connection) => ({ value: connection.connectionId, label: connection.recognition.productName ?? connection.hardwareId }))
  : connections.value.map((connection) => ({ value: connection.connectionId,
    label: `${connection.index + 1} · ${connection.recognition.family ? recognitionLabel(connection.recognition) + ' · ' : ''}${connection.hardwareId}` })));
const hidConnectionOptions = computed(() => hidConnections.value.map((connection) => ({
  value: connection.connectionId,
  label: `${connection.recognition.family ? recognitionLabel(connection.recognition) + ' · ' : ''}${connection.recognition.productName ?? connection.hardwareId}`,
})));
const discoveryError = ref(false);
const captureArea = ref<HTMLElement | null>(null);
const capturing = ref(false);
const learning = shallowRef<InputAction | null>(null);
const mask = ref<FretMask>(0);
const strums = ref(0);
const lastStrum = ref<NormalizedInputEvent['strum']>(null);
const message = ref<'invalid' | 'savedProfile' | 'selectedMismatch' | 'webHidDenied' | null>(null);
const interrupted = ref(false);
const captureMessage = computed(() => learning.value ? t('input.waiting', { action: learning.value.kind === 'fret'
  ? learning.value.fret + ' · ' + t('frets.' + learning.value.fret) : t('input.' + actionId(learning.value)) })
  : t(capturing.value ? 'input.running' : interrupted.value ? 'input.interrupted' : 'input.idle'));
let discovery: GamepadDiscovery | null = null;
const hidDiscovery = new WebHidDiscovery();
const webHidSupported = webHidAvailable();
let adapter: BrowserInputAdapter | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let identitySequence = 0;
let operation = 0;
let disposed = false;

function identity(): string {
  return globalThis.crypto?.randomUUID?.() ?? Date.now() + '-' + ++identitySequence;
}

function refreshDevices() {
  if (document.hidden) return;
  try {
    connections.value = discovery?.list() ?? [];
    discoveryError.value = false;
    selectOnlyCompatibleConnection();
  }
  catch { connections.value = []; discoveryError.value = true; }
}

async function refreshHidDevices() {
  if (!webHidSupported || document.hidden) return;
  try {
    hidConnections.value = await hidDiscovery.list();
    const compatible = hidConnections.value.filter((connection) => connection.hardwareId === draft.value.hardwareId);
    if (!selectedHidConnection.value && compatible.length === 1) ui.selectWebHid(compatible[0] ?? null);
  } catch { hidConnections.value = []; }
}

function refreshAllDevices() {
  refreshDevices();
  void refreshHidDevices();
}

async function authorizeWebHid() {
  stopCapture(); message.value = null;
  const token = operation;
  try {
    const granted = await hidDiscovery.request();
    if (disposed || token !== operation) return;
    if (granted.length === 0) { message.value = 'webHidDenied'; return; }
    await refreshHidDevices();
    if (disposed || token !== operation) return;
    const selected = granted[0];
    if (selected) ui.selectWebHid(hidConnections.value.find((item) => item.hardwareId === selected.hardwareId) ?? selected);
  } catch { message.value = 'webHidDenied'; }
}

function selectOnlyCompatibleConnection() {
  if (draft.value.kind !== 'gamepad' || selectedConnection.value?.hardwareId === draft.value.hardwareId) return;
  const compatible = connections.value.filter((connection) => connection.hardwareId === draft.value.hardwareId);
  if (compatible.length === 1) ui.selectGamepad(compatible[0] ?? null);
}

function stopCapture() {
  operation++;
  adapter?.dispose(); adapter = null;
  capturing.value = false; learning.value = null; mask.value = 0;
}

function selectProfile(id: string) {
  stopCapture();
  ui.selectProfile(id);
  draft.value = ui.profiles.find((profile) => profile.id === id) ?? DEFAULT_KEYBOARD;
  label.value = draft.value.label;
  selectOnlyCompatibleConnection();
  message.value = null;
}

function newGamepadProfile() {
  const connection = selectedConnection.value;
  if (!connection) return;
  stopCapture();
  try {
    draft.value = parseDeviceProfile({ ...DEFAULT_KEYBOARD, id: 'gamepad-' + identity(), version: '1.0.0',
      label: connection.hardwareId.slice(0, 128) || 'Gamepad', kind: 'gamepad', hardwareId: connection.hardwareId,
      recognition: connection.recognition,
      bindings: [], capabilities: { strum: 'unavailable', maximumSimultaneousFrets: null, confirmedChords: [], distinguishableExtraControls: [] }, calibrations: [],
    });
    label.value = draft.value.label; message.value = null;
  } catch { message.value = 'invalid'; }
}

function newWebHidProfile() {
  const connection = selectedHidConnection.value;
  if (!connection) return;
  stopCapture();
  try {
    draft.value = parseDeviceProfile({ ...DEFAULT_KEYBOARD, id: 'webhid-' + identity(), version: '1.0.0',
      label: connection.recognition.productName?.slice(0, 128) || 'WebHID', kind: 'webhid', hardwareId: connection.hardwareId,
      recognition: connection.recognition, bindings: [],
      capabilities: { strum: 'unavailable', maximumSimultaneousFrets: null, confirmedChords: [], distinguishableExtraControls: [] }, calibrations: [],
    });
    label.value = draft.value.label; message.value = null;
  } catch { message.value = 'invalid'; }
}

function applyControl(action: InputAction, control: InputControl) {
  stopCapture();
  try {
    const bindings = draft.value.bindings.filter((binding) => {
      if (actionId(binding.action) === actionId(action)) return false;
      return action.kind !== 'strum' || binding.action.kind !== 'strum'
        || (action.direction === 'unknown') === (binding.action.direction === 'unknown');
    });
    draft.value = withBindings(draft.value, [...bindings, { control, action }]);
    message.value = null;
  } catch { message.value = 'invalid'; }
}

function removeMapping(action: InputAction) {
  stopCapture();
  draft.value = withBindings(draft.value, draft.value.bindings.filter((binding) => actionId(binding.action) !== actionId(action)));
  message.value = null;
}

function observeFrets(frets: FretMask) {
  mask.value = frets;
  if (countFrets(frets) >= 2 && !draft.value.capabilities.confirmedChords.includes(frets as NoteFrets)) {
    draft.value = parseDeviceProfile({ ...draft.value, capabilities: { ...draft.value.capabilities,
      confirmedChords: [...draft.value.capabilities.confirmedChords, frets],
      maximumSimultaneousFrets: draft.value.capabilities.maximumSimultaneousFrets !== null
        && countFrets(frets) > draft.value.capabilities.maximumSimultaneousFrets ? null : draft.value.capabilities.maximumSimultaneousFrets,
    } });
  }
}

function observeExtra(control: InputControl) {
  const key = controlId(control);
  if (draft.value.bindings.some((binding) => controlId(binding.control) === key)
    || draft.value.capabilities.distinguishableExtraControls.includes(key)
    || draft.value.capabilities.distinguishableExtraControls.length >= 64) return;
  draft.value = parseDeviceProfile({ ...draft.value, capabilities: { ...draft.value.capabilities,
    distinguishableExtraControls: [...draft.value.capabilities.distinguishableExtraControls, key],
  } });
}

async function beginCapture(action?: InputAction) {
  stopCapture(); message.value = null; interrupted.value = false;
  const token = operation;
  if (!captureArea.value) return;
  refreshDevices(); await refreshHidDevices();
  if (disposed || token !== operation || !captureArea.value) return;
  const gamepad = selectedConnection.value;
  if (draft.value.kind === 'gamepad' && (!gamepad || gamepad.hardwareId !== draft.value.hardwareId)) { message.value = 'selectedMismatch'; return; }
  const hid = selectedHidConnection.value;
  if (draft.value.kind === 'webhid' && (!hid || hid.hardwareId !== draft.value.hardwareId)) { message.value = 'selectedMismatch'; return; }
  learning.value = action ?? null;
  strums.value = 0; lastStrum.value = null;
  const origin = performance.now();
  try {
    if (hid) await hidDiscovery.open(hid);
    if (disposed || token !== operation || !captureArea.value) return;
    adapter = new BrowserInputAdapter({ profile: action ? withBindings(draft.value, []) : draft.value,
      scope: captureArea.value, timeline: { sample: (now) => now - origin },
      ...(draft.value.kind === 'gamepad' && gamepad ? { gamepad } : {}),
      ...(draft.value.kind === 'webhid' && hid ? { webhid: hid } : {}),
      onBaseline: observeFrets,
      onEvent(event) {
        observeFrets(event.activeFrets);
        if (event.strum !== null) { strums.value++; lastStrum.value = event.strum; }
      },
      onControl: action ? (control) => applyControl(action, control) : observeExtra,
      onInterrupt() { capturing.value = false; learning.value = null; interrupted.value = true; },
    });
    adapter.start();
    capturing.value = adapter.capturing;
    if (capturing.value) captureArea.value.scrollIntoView({ block: 'center' });
  } catch { stopCapture(); interrupted.value = true; }
}

function saveProfile() {
  stopCapture();
  try {
    const profile = validateMapping({ ...draft.value, label: label.value.trim(), version: 'revision-' + identity(), calibrations: [] }, true);
    ui.saveProfile(profile); draft.value = profile; message.value = 'savedProfile';
  } catch { message.value = 'invalid'; }
}

function maskLabel(value: number) { return (Object.keys(FRET_BITS) as (keyof typeof FRET_BITS)[]).filter((fret) => value & FRET_BITS[fret]).join('+'); }
function hexId(value: number) { return '0x' + value.toString(16).padStart(4, '0').toUpperCase(); }
watch(connectionId, () => { stopCapture(); message.value = null; });
onMounted(() => { discovery = new GamepadDiscovery(); refreshDevices(); void refreshHidDevices(); timer = setInterval(() => {
  refreshDevices(); void refreshHidDevices();
}, 1000); });
onBeforeUnmount(() => { disposed = true; stopCapture(); if (timer !== null) clearInterval(timer); discovery?.dispose(); hidDiscovery.dispose(); });
</script>

<style scoped>
.device-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.capture-area { padding: 1rem; border: 2px dashed currentColor; border-radius: 12px; }
.capture-area:focus { outline: 3px solid var(--q-primary); outline-offset: 4px; }
.extra-controls { overflow-wrap: anywhere; }
.device-recognition { font-weight: 700; color: var(--fs-accent); }
@media (max-width: 700px) { .device-fields { grid-template-columns: 1fr; } }
</style>
