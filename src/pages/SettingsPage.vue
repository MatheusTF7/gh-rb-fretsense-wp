<template>
  <PageFrame>
    <PageHeading :eyebrow="t('settings.eyebrow')" :title="t('settings.title')" :description="t('settings.description')" />
    <StorageNotice />
    <div class="settings-grid section-spacing">
      <div class="settings-controls">
        <fieldset class="surface-card settings-group" aria-describedby="language-help">
          <legend>{{ t('settings.language') }}</legend>
          <p id="language-help">{{ t('settings.languageDescription') }}</p>
          <q-option-group v-model="ui.locale" :options="languageOptions" color="primary" />
        </fieldset>
        <fieldset class="surface-card settings-group" aria-describedby="appearance-help">
          <legend>{{ t('settings.appearance') }}</legend>
          <p id="appearance-help">{{ t('settings.appearanceDescription') }}</p>
          <q-option-group v-model="ui.theme" :options="themeOptions" color="primary" inline />
        </fieldset>
        <fieldset class="surface-card settings-group" aria-describedby="motion-help">
          <legend>{{ t('settings.accessibility') }}</legend>
          <q-toggle v-model="ui.reducedMotion" :label="t('settings.reducedMotion')" color="primary" />
          <p id="motion-help">{{ t('settings.reducedMotionDescription') }}</p>
        </fieldset>
        <fieldset class="surface-card settings-group highway-settings" aria-describedby="highway-help">
          <legend>{{ t('settings.highway.title') }}</legend>
          <p id="highway-help">{{ t('settings.highway.description') }}</p>
          <label>{{ t('settings.highway.speed', { value: ui.highway.scrollSpeed }) }}</label>
          <q-slider v-model="ui.highway.scrollSpeed" :min="180" :max="600" :step="20" label color="primary" />
          <label>{{ t('settings.highway.noteScale', { value: Math.round(ui.highway.noteScale * 100) }) }}</label>
          <q-slider v-model="ui.highway.noteScale" :min="0.8" :max="1.3" :step="0.05" label color="primary" />
          <label>{{ t('settings.highway.perspective', { value: Math.round(ui.highway.perspectiveIntensity * 100) }) }}</label>
          <q-slider v-model="ui.highway.perspectiveIntensity" :min="0" :max="1" :step="0.05" label color="primary" />
          <label>{{ t('settings.highway.gridContrast', { value: Math.round(ui.highway.gridContrast * 100) }) }}</label>
          <q-slider v-model="ui.highway.gridContrast" :min="0" :max="1" :step="0.05" label color="primary" />
          <q-select v-model="ui.highway.effects" :options="effectOptions" emit-value map-options
            :label="t('settings.highway.effects')" />
          <q-toggle v-model="ui.highway.highContrast" :label="t('settings.highway.highContrast')" color="primary" />
        </fieldset>
      </div>
      <section class="surface-card settings-reference">
        <q-icon name="visibility" class="card-icon" aria-hidden="true" />
        <h2>{{ t('settings.fretTitle') }}</h2>
        <p>{{ t('settings.fretDescription') }}</p>
        <FretLegend />
      </section>
    </div>
  </PageFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useInterfaceStore } from '@/stores/interface';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import StorageNotice from '@/components/StorageNotice.vue';
import FretLegend from '@/components/training/FretLegend.vue';

const { t } = useI18n();
const ui = useInterfaceStore();
const languageOptions = [
  { label: 'Português (Brasil)', value: 'pt-BR' },
  { label: 'English (United States)', value: 'en-US' },
];
const themeOptions = computed(() => [
  { label: t('settings.dark'), value: 'dark' },
  { label: t('settings.light'), value: 'light' },
  { label: t('settings.system'), value: 'system' },
]);
const effectOptions = computed(() => ['full', 'reduced', 'off'].map((value) => ({
  value, label: t(`settings.highway.effectLevels.${value}`),
})));
</script>

<style scoped>
.highway-settings { display: grid; gap: 10px; }
.highway-settings p { margin-bottom: 6px; }
</style>
