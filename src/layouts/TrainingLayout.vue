<template>
  <q-layout view="hHh lpR fFf" class="training-layout" :class="{ 'training-layout--focus': ui.trainingFocus }">
    <SkipLink />
    <q-header v-if="!ui.trainingFocus" bordered class="app-header">
      <q-toolbar class="training-toolbar">
        <AppBrand />
        <q-space />
        <q-btn flat no-caps icon="arrow_back" :to="{ name: 'train' }" :label="t('common.backCatalog')" />
        <q-btn
          flat
          round
          icon="tune"
          :to="{ name: 'settings' }"
          :aria-label="t('navigation.settings')"
        />
      </q-toolbar>
    </q-header>
    <q-page-container><router-view /></q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppBrand from '@/components/AppBrand.vue';
import SkipLink from '@/components/SkipLink.vue';
import { useInterfaceStore } from '@/stores/interface';

const { t } = useI18n();
const ui = useInterfaceStore();
</script>

<style scoped>
.training-layout--focus :deep(.page-frame) { max-width: 1480px; padding-top: 20px; }
</style>
