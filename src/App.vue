<template>
  <router-view />
</template>

<script setup lang="ts">
import { nextTick, watch, watchEffect } from 'vue';
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
</script>
