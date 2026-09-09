<template>
  <q-expansion-item class="local-diagnostics surface-card" icon="bug_report" :label="t('play.diagnostics.title')">
    <p>{{ t('play.diagnostics.description') }}</p>
    <dl>
      <div><dt>{{ t('play.diagnostics.version') }}</dt><dd>{{ FRETSENSE_APP_VERSION }}</dd></div>
      <div><dt>{{ t('play.diagnostics.session') }}</dt><dd>{{ snapshot.id }}</dd></div>
      <div><dt>{{ t('play.diagnostics.profile') }}</dt><dd>{{ snapshot.device.id }}@{{ snapshot.device.version }}</dd></div>
      <div><dt>{{ t('play.seed') }}</dt><dd>{{ snapshot.config.seed }}</dd></div>
    </dl>
    <div class="local-diagnostics__actions">
      <q-btn outline no-caps icon="content_copy" :label="t('play.diagnostics.copy')" @click="copyDiagnostic" />
      <q-btn flat no-caps icon="download" :label="t('play.diagnostics.download')" @click="downloadDiagnostic" />
    </div>
    <p class="local-diagnostics__status" role="status" aria-live="polite">{{ statusMessage }}</p>
  </q-expansion-item>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  HighwayVisualPreferences, SessionResult, SessionSnapshot, SessionState,
} from '@/engine/domain';
import type { SessionStorageState } from '@/platform/storage';
import { createLocalDiagnostic, FRETSENSE_APP_VERSION } from '@/platform/diagnostics/local-diagnostics';

const props = defineProps<{
  snapshot: SessionSnapshot;
  state: SessionState;
  activeTimeMs: number;
  inputCount: number;
  judgmentCount: number;
  interruptionCount: number;
  currentVisualPreferences: HighwayVisualPreferences;
  result: SessionResult | null;
  storage: SessionStorageState;
}>();
const { t } = useI18n();
const status = ref<'idle' | 'copied' | 'copyFailed' | 'downloaded'>('idle');
const statusMessage = computed(() => status.value === 'idle' ? '' : t(`play.diagnostics.${status.value}`));

function serializedDiagnostic(): string {
  return JSON.stringify(createLocalDiagnostic({
    snapshot: props.snapshot,
    state: props.state,
    activeTimeMs: props.activeTimeMs,
    inputCount: props.inputCount,
    judgmentCount: props.judgmentCount,
    interruptionCount: props.interruptionCount,
    currentVisualPreferences: props.currentVisualPreferences,
    result: props.result,
    storage: props.storage,
  }), null, 2);
}

async function copyDiagnostic(): Promise<void> {
  try {
    await navigator.clipboard.writeText(serializedDiagnostic());
    status.value = 'copied';
  } catch {
    status.value = 'copyFailed';
  }
}

function downloadDiagnostic(): void {
  const blob = new Blob([serializedDiagnostic()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `fretsense-diagnostic-${props.snapshot.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  status.value = 'downloaded';
}
</script>

<style scoped>
.local-diagnostics { margin-top: 24px; }
.local-diagnostics :deep(.q-item) { min-height: 48px; padding-inline: 0; }
.local-diagnostics p { color: var(--fs-muted); }
.local-diagnostics dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.local-diagnostics dt { color: var(--fs-muted); font-size: .75rem; }
.local-diagnostics dd { margin: 0; overflow-wrap: anywhere; font-weight: 700; }
.local-diagnostics__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.local-diagnostics__status { min-height: 1.5em; margin: 10px 0 0; }
@media (max-width: 599px) { .local-diagnostics dl { grid-template-columns: minmax(0, 1fr); } }
</style>
