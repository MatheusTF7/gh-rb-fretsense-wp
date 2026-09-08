<template>
  <section class="chart-preview" :aria-label="t('play.preview.title')">
    <div class="chart-preview__summary">
      <strong>{{ t('play.preview.title') }}</strong>
      <span>{{ t('play.preview.count', { shown: visibleNotes.length, total: chart.notes.length }) }}</span>
    </div>
    <ol class="chart-preview__notes">
      <li v-for="note in visibleNotes" :key="note.id">
        <span class="chart-preview__tick">{{ note.tick }}</span>
        <span class="chart-preview__frets">
          <i v-for="fret in noteFrets(note.frets)" :key="fret" :data-fret="fret">{{ fret }}</i>
        </span>
        <span>{{ t(`play.${note.articulation}`) }}</span>
        <span v-if="note.durationTicks">+{{ note.durationTicks }}</span>
      </li>
    </ol>
    <p v-if="chart.notes.length > visibleNotes.length" class="muted-text">
      {{ t('play.preview.remaining', { count: chart.notes.length - visibleNotes.length }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Chart, Fret, NoteFrets } from '@/engine/domain';
import { FRET_BITS } from '@/engine/domain';

const props = defineProps<{ chart: Chart; limit?: number }>();
const { t } = useI18n();
const fretOrder: readonly Fret[] = ['G', 'R', 'Y', 'B', 'O'];
const visibleNotes = computed(() => props.chart.notes.slice(0, props.limit ?? 16));

function noteFrets(mask: NoteFrets): Fret[] {
  return fretOrder.filter((fret) => (mask & FRET_BITS[fret]) !== 0);
}
</script>

<style scoped>
.chart-preview { min-width: 0; padding: 18px; border: 1px solid var(--fs-border); border-radius: 12px; background: var(--fs-raised); }
.chart-preview__summary { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.chart-preview__summary span { color: var(--fs-muted); font-size: .85rem; }
.chart-preview__notes { display: flex; gap: 8px; margin: 0; padding: 0 0 10px; overflow-x: auto; list-style: none; }
.chart-preview__notes li { min-width: 72px; display: grid; justify-items: center; gap: 5px; padding: 9px; border: 1px solid var(--fs-border); border-radius: 8px; background: var(--fs-surface); font-size: .75rem; }
.chart-preview__tick { color: var(--fs-muted); }
.chart-preview__frets { display: flex; gap: 3px; }
.chart-preview__frets i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; color: #15221a; background: var(--fret-color); font-style: normal; font-weight: 700; }
.chart-preview > p { margin: 8px 0 0; }
</style>
