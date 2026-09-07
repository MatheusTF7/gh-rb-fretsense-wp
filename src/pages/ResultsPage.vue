<template>
  <PageFrame>
    <PageState heading="h1" icon="receipt_long" :title="t('results.title')" :description="t('results.description')">
      <q-btn unelevated color="primary" no-caps :to="{ name: 'history' }" :label="t('common.viewHistory')" />
      <q-btn outline no-caps :to="{ name: 'train' }" :label="t('common.browseCatalog')" />
    </PageState>
  </PageFrame>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PageFrame from '@/components/PageFrame.vue';
import PageState from '@/components/PageState.vue';

const { t } = useI18n();
</script>
