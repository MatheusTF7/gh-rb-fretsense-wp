<template>
  <PageFrame>
    <template v-if="record">
      <PageHeading :eyebrow="t(`play.mode.${record.snapshot.mode}`)" :title="t('results.title')"
        :description="t('results.description', { id: record.snapshot.id })">
        <template #actions>
          <span class="status-tag">{{ t(`play.ending.${record.result.ending.state}`) }}</span>
        </template>
      </PageHeading>

      <FeedbackBanner v-if="!record.result.progression.eligible" tone="error"
        :message="t(record.snapshot.mode === 'assessment' ? 'play.assessmentIneligible' : 'results.ineligible')" />

      <section class="surface-card result-detail" aria-labelledby="result-detail-title">
        <h2 id="result-detail-title">{{ t(`techniques.${record.snapshot.config.technique}.title`) }} · {{ t(`catalog.levels.${record.snapshot.config.level}`) }}</h2>
        <dl class="result-detail__context">
          <div><dt>{{ t('play.bpm') }}</dt><dd>{{ record.snapshot.config.bpm }}</dd></div>
          <div><dt>{{ t('play.notesPlanned') }}</dt><dd>{{ record.snapshot.chart.notes.length }}</dd></div>
          <div><dt>{{ t('play.ruleProfile') }}</dt><dd>{{ record.snapshot.rules.id }}@{{ record.snapshot.rules.version }}</dd></div>
          <div><dt>{{ t('play.profile') }}</dt><dd>{{ record.snapshot.device.label }}</dd></div>
          <div><dt>{{ t('play.calibration') }}</dt><dd>{{ record.snapshot.calibration.id }}@{{ record.snapshot.calibration.version }}</dd></div>
          <div><dt>{{ t('play.seed') }}</dt><dd>{{ record.snapshot.config.seed }}</dd></div>
        </dl>

        <div class="result-detail__metrics">
          <div><span>{{ t('play.accuracy') }}</span><strong>{{ ratioLabel(record.result.metrics.noteAccuracy) }}</strong></div>
          <div><span>{{ t('play.hits') }}</span><strong>{{ record.result.metrics.hitNotes }}/{{ record.result.metrics.plannedNotes }}</strong></div>
          <div><span>{{ t('play.bestCombo') }}</span><strong>{{ record.result.metrics.bestCombo }}</strong></div>
          <div><span>{{ t('play.meanTiming') }}</span><strong>{{ timingLabel }}</strong></div>
          <div><span>{{ t('play.articulationCompliance') }}</span><strong>{{ ratioLabel(record.result.metrics.articulationCompliance) }}</strong></div>
          <div><span>{{ t('play.extraStrums') }}</span><strong>{{ record.result.metrics.extraStrums }}</strong></div>
          <div v-if="hasSustains"><span>{{ t('play.sustainCompletion') }}</span><strong>{{ ratioLabel(record.result.metrics.sustainCompletion) }}</strong></div>
          <div v-if="hasSustains"><span>{{ t('play.brokenSustains') }}</span><strong>{{ record.result.metrics.brokenSustains }}</strong></div>
          <div v-if="record.snapshot.config.strumDirectionGoal.kind !== 'none'">
            <span>{{ t('play.directionCompliance') }}</span>
            <strong>{{ ratioLabel(record.result.metrics.strumDirectionCompliance) }}</strong>
          </div>
          <div><span>{{ t('play.duration') }}</span><strong>{{ (record.result.activeDurationMs / 1000).toFixed(1) }} s</strong></div>
        </div>

        <p v-if="record.result.interruptions.length" class="muted-text">
          {{ t('play.interruptions', { count: record.result.interruptions.length }) }}
        </p>
        <ChartPreview :chart="record.snapshot.chart" />
        <SessionAnalysisReport v-if="record.result.analysis" :report="record.result.analysis" />
        <FeedbackBanner v-else tone="error" :message="t('results.analysis.notPerformed')" />
        <div class="result-detail__actions">
          <q-btn unelevated color="primary" no-caps icon="tune" :to="{ name: 'play' }" :label="t('results.backToConfiguration')" />
          <q-btn outline no-caps :to="{ name: 'train' }" :label="t('common.browseCatalog')" />
        </div>
      </section>
    </template>

    <PageState v-else heading="h1" icon="receipt_long" :title="t('results.missingTitle')" :description="t('results.missingDescription')">
      <q-btn unelevated color="primary" no-caps :to="{ name: 'play' }" :label="t('results.backToConfiguration')" />
      <q-btn outline no-caps :to="{ name: 'train' }" :label="t('common.browseCatalog')" />
    </PageState>
  </PageFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import type { RatioMetric } from '@/engine/domain';
import { useTrainingStore } from '@/stores/training';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import PageState from '@/components/PageState.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';
import ChartPreview from '@/components/training/ChartPreview.vue';
import SessionAnalysisReport from '@/components/reports/SessionAnalysisReport.vue';

const { t } = useI18n();
const route = useRoute();
const workspace = useTrainingStore();
const record = computed(() => {
  const latest = workspace.latestRecord;
  return latest?.snapshot.id === route.params.id ? latest : null;
});
const hasSustains = computed(() => record.value?.snapshot.chart.notes.some((note) => note.durationTicks > 0) ?? false);
const timingLabel = computed(() => {
  const timing = record.value?.result.metrics.timing;
  if (timing?.status !== 'available') return t('play.unavailable');
  const rounded = Math.round(timing.meanErrorMs);
  return `${rounded > 0 ? '+' : ''}${rounded} ms`;
});

function ratioLabel(metric: RatioMetric): string {
  return metric.status === 'available' ? `${Math.round(metric.value * 100)}%` : t('play.unavailable');
}
</script>

<style scoped>
.result-detail { display: grid; gap: 24px; }
.result-detail h2 { margin: 0; }
.result-detail__context, .result-detail__metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
.result-detail__context > div, .result-detail__metrics > div { min-width: 0; padding: 14px; border: 1px solid var(--fs-border); border-radius: 10px; }
.result-detail dt, .result-detail__metrics span { color: var(--fs-muted); font-size: .75rem; }
.result-detail dd { margin: 3px 0 0; overflow-wrap: anywhere; font-weight: 700; }
.result-detail__metrics span, .result-detail__metrics strong { display: block; }
.result-detail__actions { display: flex; flex-wrap: wrap; gap: 10px; }
@media (max-width: 700px) { .result-detail__context, .result-detail__metrics { grid-template-columns: 1fr; } }
</style>
