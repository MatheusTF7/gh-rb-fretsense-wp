<template>
  <q-layout view="hHh lpR fFf" class="training-layout">
    <SkipLink />
    <q-header bordered class="app-header">
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

const { t } = useI18n();
</script>
