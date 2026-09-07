<template>
  <router-link class="app-brand" :to="{ name: 'home' }" :aria-label="`Fretsense — ${t('navigation.home')}`">
    <span class="brand-mark" aria-hidden="true">
      <span v-for="fret in frets" :key="fret" :data-fret="fret" />
    </span>
    <span>fretsense<span class="brand-period">.</span></span>
  </router-link>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const frets = ['G', 'R', 'Y', 'B', 'O'] as const;
</script>
