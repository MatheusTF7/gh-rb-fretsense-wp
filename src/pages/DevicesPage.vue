<template>
  <PageFrame>
    <PageHeading :eyebrow="t('devices.eyebrow')" :title="t('devices.title')" :description="t('devices.description')" />
    <FeedbackBanner :message="t('devices.notice')" />
    <div class="card-grid section-spacing">
      <article v-for="device in devices" :key="device.id" class="surface-card">
        <q-icon :name="device.icon" class="card-icon" aria-hidden="true" />
        <h2>{{ t(`devices.${device.id}Title`) }}</h2>
        <p>{{ t(`devices.${device.id}Description`) }}</p>
        <span class="status-tag status-tag--subtle">{{ t('common.planned') }}</span>
      </article>
    </div>
    <section class="surface-card inline-card section-spacing">
      <div>
        <h2>{{ t('devices.calibrationTitle') }}</h2>
        <p>{{ t('devices.calibrationDescription') }}</p>
      </div>
      <q-btn outline no-caps :to="{ name: 'calibration' }" :label="t('common.viewCalibration')" />
    </section>
  </PageFrame>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';

const { t } = useI18n();
const devices = [
  { id: 'keyboard', icon: 'keyboard' },
  { id: 'guitar', icon: 'music_note' },
  { id: 'gamepad', icon: 'sports_esports' },
] as const;
</script>
