<template>
  <PageFrame>
    <PageHeading :eyebrow="t('settings.eyebrow')" :title="t('settings.title')" :description="t('settings.description')" />
    <FeedbackBanner :message="t('settings.notice')" />
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
import FeedbackBanner from '@/components/FeedbackBanner.vue';
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
</script>
