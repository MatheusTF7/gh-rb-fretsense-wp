<template>
  <router-view />
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useQuasar } from 'quasar';
import quasarPtBR from 'quasar/lang/pt-BR';
import quasarEnUS from 'quasar/lang/en-US';
import { useInterfaceStore } from '@/stores/interface';

const ui = useInterfaceStore();
const route = useRoute();
const quasar = useQuasar();
const { locale, t } = useI18n({ useScope: 'global' });

let preferenceTimer: ReturnType<typeof setTimeout> | null = null;
let interfacePreferencesDirty = false;
let highwayPreferencesDirty = false;

function flushPreferences(): void {
  if (preferenceTimer !== null) clearTimeout(preferenceTimer);
  preferenceTimer = null;
  if (interfacePreferencesDirty) ui.persistInterface();
  if (highwayPreferencesDirty) ui.persistHighway();
  interfacePreferencesDirty = false;
  highwayPreferencesDirty = false;
}

function schedulePreferencePersistence(): void {
  if (preferenceTimer !== null) clearTimeout(preferenceTimer);
  preferenceTimer = setTimeout(flushPreferences, 120);
}

watch(() => [ui.locale, ui.theme, ui.reducedMotion], () => {
  interfacePreferencesDirty = true;
  schedulePreferencePersistence();
});
watch(() => [
  ui.highway.scrollSpeed, ui.highway.noteScale, ui.highway.perspectiveIntensity,
  ui.highway.gridContrast, ui.highway.effects, ui.highway.highContrast,
], () => {
  highwayPreferencesDirty = true;
  schedulePreferencePersistence();
});

watch(
  () => ui.locale,
  (value) => {
    locale.value = value;
    quasar.lang.set(value === 'pt-BR' ? quasarPtBR : quasarEnUS);
    if (typeof document !== 'undefined') document.documentElement.lang = value;
  },
  { immediate: true },
);

watch(
  () => ui.theme,
  (value) => quasar.dark.set(value === 'system' ? 'auto' : value === 'dark'),
  { immediate: true },
);

watch(
  () => ui.reducedMotion,
  (value) => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.reducedMotion = String(value);
    }
  },
  { immediate: true },
);

watchEffect(() => {
  const titleKey = route.meta.titleKey;
  if (typeof document !== 'undefined') {
    document.title = titleKey ? `${t(`navigation.${titleKey}`)} · Fretsense` : 'Fretsense';
  }
});

watch(
  () => route.path,
  async () => {
    await nextTick();
    if (typeof document !== 'undefined') {
      document.getElementById('main-content')?.focus({ preventScroll: true });
    }
  },
  { flush: 'post' },
);

onMounted(() => window.addEventListener('pagehide', flushPreferences));
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', flushPreferences);
  flushPreferences();
});
</script>
