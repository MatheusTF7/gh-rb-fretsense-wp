<template>
  <PageFrame>
    <PageHeading :eyebrow="t('calibration.eyebrow')" :title="t('calibration.title')" :description="t('calibration.description')" />
    <PageState icon="graphic_eq" :title="t('calibration.stateTitle')" :description="t('calibration.stateDescription')">
      <q-btn unelevated color="primary" no-caps :to="{ name: 'devices' }" :label="t('common.viewDevices')" />
    </PageState>
  </PageFrame>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import PageState from '@/components/PageState.vue';

const { t } = useI18n();
</script>
