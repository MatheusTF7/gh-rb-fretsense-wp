<template>
  <ol class="fret-legend" :aria-label="t('frets.label')">
    <li v-for="(fret, index) in frets" :key="fret" :data-fret="fret">
      <span class="fret-legend__position">{{ index + 1 }}</span>
      <span class="fret-legend__letter">{{ fret }}</span>
      <span class="fret-legend__name">{{ t(`frets.${fret}`) }}</span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { Fret } from '@/engine/domain';

const { t } = useI18n();
const frets: readonly Fret[] = ['G', 'R', 'Y', 'B', 'O'];
</script>
