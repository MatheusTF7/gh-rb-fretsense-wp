<template>
  <PageFrame>
    <p class="error-code" aria-hidden="true">404</p>
    <PageState heading="h1" icon="wrong_location" :title="t('errors.notFoundTitle')" :description="t('errors.notFoundDescription')">
      <q-btn unelevated color="primary" no-caps :to="{ name: 'home' }" :label="t('common.backHome')" />
    </PageState>
  </PageFrame>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PageFrame from '@/components/PageFrame.vue';
import PageState from '@/components/PageState.vue';

const { t } = useI18n();
</script>
