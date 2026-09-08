<template>
  <section class="execution-details" aria-labelledby="execution-details-title">
    <div>
      <p class="section-kicker">{{ t('results.execution.eyebrow') }}</p>
      <h2 id="execution-details-title">{{ t('results.execution.title') }}</h2>
    </div>

    <section class="execution-section" aria-labelledby="timing-distribution-title">
      <h3 id="timing-distribution-title">{{ t('results.execution.timingTitle') }}</h3>
      <template v-if="details.timingDistribution.status === 'available'">
        <p class="muted-text">{{ t('results.execution.timingSamples', { count: details.timingDistribution.sampleCount }) }}</p>
        <div class="timing-bars" aria-hidden="true">
          <div v-for="bin in details.timingDistribution.bins" :key="bin.id">
            <span>{{ t(`results.execution.bins.${bin.id}`) }}</span>
            <div><i :style="{ width: `${Math.round(bin.ratio * 100)}%` }" /></div>
            <strong>{{ Math.round(bin.ratio * 100) }}%</strong>
          </div>
        </div>
        <div class="table-scroll">
          <table class="analysis-table">
            <thead><tr><th>{{ t('results.execution.range') }}</th><th>{{ t('results.execution.classification') }}</th><th>{{ t('results.execution.count') }}</th><th>{{ t('results.execution.share') }}</th></tr></thead>
            <tbody>
              <tr v-for="bin in details.timingDistribution.bins" :key="`table-${bin.id}`">
                <th scope="row">{{ rangeLabel(bin.minimumMs, bin.maximumMs) }}</th>
                <td>{{ t(`results.execution.bins.${bin.id}`) }}</td>
                <td>{{ bin.count }}</td>
                <td>{{ Math.round(bin.ratio * 100) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <p v-else class="muted-text">{{ t(`results.execution.unavailable.${details.timingDistribution.reason}`) }}</p>
    </section>

    <section class="execution-section" aria-labelledby="pattern-errors-title">
      <h3 id="pattern-errors-title">{{ t('results.execution.patternTitle') }}</h3>
      <template v-if="details.patternErrors.status === 'available'">
        <p v-if="details.patternErrors.rows.length === 0" class="muted-text">{{ t('results.execution.noMappedErrors') }}</p>
        <template v-else>
          <p class="muted-text">{{ t('results.execution.mappedErrors', {
            shown: details.patternErrors.rows.length, total: details.patternErrors.referencedNotes,
          }) }}</p>
          <div class="pattern-map" aria-hidden="true">
            <span v-for="row in details.patternErrors.rows" :key="`marker-${row.noteId}`"
              :style="{ left: `${Math.min(100, Math.max(0, row.positionRatio * 100))}%` }" />
          </div>
          <div class="table-scroll">
            <table class="analysis-table">
              <thead><tr><th>{{ t('results.execution.position') }}</th><th>{{ t('results.execution.expected') }}</th><th>{{ t('results.execution.segment') }}</th><th>{{ t('results.execution.errors') }}</th></tr></thead>
              <tbody>
                <tr v-for="row in details.patternErrors.rows" :key="row.noteId">
                  <th scope="row">{{ row.tick }} ticks</th>
                  <td>{{ fretMaskLabel(row.expectedFrets) }}</td>
                  <td>{{ row.segmentId }}</td>
                  <td>{{ row.diagnosticCodes.map((code) => t(`results.analysis.diagnostics.${code}`)).join('; ') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="details.patternErrors.omittedRows" class="muted-text">
            {{ t('results.execution.omittedRows', { count: details.patternErrors.omittedRows }) }}
          </p>
        </template>
      </template>
      <p v-else class="muted-text">{{ t('results.execution.unavailable.analysis-not-performed') }}</p>
    </section>

    <p class="muted-text execution-policy">{{ t('results.execution.policy', {
      policy: `${details.policy.id}@${details.policy.version}`,
    }) }}</p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { FretMask } from '@/engine/domain';
import { FRET_BITS } from '@/engine/domain';
import type { SessionExecutionDetails } from '@/engine/reporting';

defineProps<{ details: SessionExecutionDetails }>();
const { t } = useI18n();

function rangeLabel(minimum: number, maximum: number): string {
  const signed = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value)}`;
  return `${signed(minimum)}–${signed(maximum)} ms`;
}

function fretMaskLabel(mask: FretMask): string {
  const labels = (Object.entries(FRET_BITS) as [keyof typeof FRET_BITS, number][])
    .filter(([, bit]) => (mask & bit) !== 0).map(([fret]) => fret);
  return labels.length ? labels.join('+') : '—';
}
</script>

<style scoped>
.execution-details { display: grid; gap: 22px; padding-top: 8px; border-top: 1px solid var(--fs-border); }
.execution-details h2, .execution-section h3 { margin: 0; }
.section-kicker { margin: 0 0 4px; color: var(--q-primary); font-size: .75rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.execution-section { display: grid; gap: 12px; }
.execution-section > p { margin: 0; }
.timing-bars { display: grid; gap: 8px; }
.timing-bars > div { display: grid; grid-template-columns: minmax(100px, .6fr) minmax(160px, 2fr) 50px; gap: 10px; align-items: center; }
.timing-bars div div { height: 8px; overflow: hidden; border-radius: 999px; background: var(--fs-raised); }
.timing-bars i { display: block; height: 100%; border-radius: inherit; background: var(--q-primary); }
.timing-bars span, .timing-bars strong { font-size: .8rem; }
.pattern-map { position: relative; height: 28px; margin-inline: 4px; border-block: 1px solid var(--fs-border); background: linear-gradient(90deg, transparent, var(--fs-raised)); }
.pattern-map span { position: absolute; top: 4px; width: 4px; height: 18px; border-radius: 2px; background: var(--q-negative); transform: translateX(-2px); }
.table-scroll { max-width: 100%; overflow-x: auto; }
.analysis-table { width: 100%; border-collapse: collapse; }
.analysis-table th, .analysis-table td { padding: 10px 12px; border: 1px solid var(--fs-border); text-align: left; }
.analysis-table thead th { color: var(--fs-muted); font-size: .75rem; }
.execution-policy { margin: 0; }
@media (max-width: 599px) { .timing-bars > div { grid-template-columns: minmax(90px, 1fr) 2fr 42px; } }
</style>
