<template>
  <section :aria-label="t('input.monitor')">
    <h2>{{ t('input.monitor') }}</h2>
    <ol class="fret-legend" :aria-label="t('frets.label')">
      <li v-for="(fret, index) in frets" :key="fret" :data-fret="fret" :class="{ 'fret-held': (mask & FRET_BITS[fret]) !== 0 }">
        <span class="fret-legend__position">{{ index + 1 }}</span>
        <span class="fret-legend__letter">{{ fret }}</span>
        <span class="fret-legend__name">{{ t(`frets.${fret}`) }}</span>
        <strong>{{ t((mask & FRET_BITS[fret]) !== 0 ? 'input.held' : 'input.released') }}</strong>
      </li>
    </ol>
    <p>{{ t('input.strums', { count: strums }) }}</p>
    <p v-if="lastStrum">{{ t('input.lastStrum', { direction: t(`input.${lastStrum}`) }) }}</p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { FRET_BITS } from '@/engine/domain/music';
import type { FretMask, NormalizedInputEvent } from '@/engine/domain';
defineProps<{ mask: FretMask; strums: number; lastStrum: NormalizedInputEvent['strum'] }>();
const { t } = useI18n();
const frets = ['G', 'R', 'Y', 'B', 'O'] as const;
</script>

<style scoped>
.fret-held { outline: 3px solid currentColor; outline-offset: 2px; }
.fret-legend strong { font-size: 0.75rem; }
</style>
