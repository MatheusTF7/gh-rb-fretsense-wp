<template>
  <PageFrame>
    <PageHeading :eyebrow="t('history.eyebrow')" :title="t('history.title')" :description="t('history.description')" />
    <PageState icon="history" :title="t('history.stateTitle')" :description="t('history.stateDescription')">
      <q-btn unelevated color="primary" no-caps :to="{ name: 'train' }" :label="t('common.browseCatalog')" />
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
