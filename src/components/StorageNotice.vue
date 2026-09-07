<template>
  <FeedbackBanner :message="t(`input.${ui.storageStatus}`)" :tone="ui.storageStatus === 'saved' ? 'info' : 'error'">
    <template v-if="ui.storageStatus === 'memory'" #actions>
      <q-btn flat no-caps :label="t('input.retry')" @click="ui.retryStorage()" />
    </template>
  </FeedbackBanner>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useInterfaceStore } from '@/stores/interface';
import FeedbackBanner from './FeedbackBanner.vue';
const { t } = useI18n();
const ui = useInterfaceStore();
</script>
