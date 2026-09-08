<template>
  <PageFrame>
    <PageState v-if="history.detailLoading && !record" heading="h1" icon="hourglass_top"
      :title="t('results.loadingTitle')" :description="t('results.loadingDescription')" />

    <template v-else-if="record">
      <PageHeading :eyebrow="t(`play.mode.${record.snapshot.mode}`)" :title="t('results.title')"
        :description="t('results.description', { id: record.snapshot.id })">
        <template #actions>
          <span class="status-tag">{{ t(`play.ending.${record.result.ending.state}`) }}</span>
        </template>
      </PageHeading>

      <FeedbackBanner v-if="!record.result.progression.eligible" tone="error"
        :message="t(record.snapshot.mode === 'assessment' ? 'play.assessmentIneligible' : 'results.ineligible')" />
      <FeedbackBanner v-if="history.storageState.mode === 'memory'" tone="error"
        :message="t(`history.storage.${history.storageState.issue ?? 'memory'}`)" />
      <FeedbackBanner v-else-if="adaptation.storageState.mode === 'memory'" tone="error"
        :message="t(`history.storage.${adaptation.storageState.issue ?? 'memory'}`)" />
      <FeedbackBanner v-if="removalFailed" tone="error" :message="t('results.removeFailed')" />

      <section class="surface-card result-detail" aria-labelledby="result-detail-title">
        <h2 id="result-detail-title">{{ t(`techniques.${record.snapshot.config.technique}.title`) }} · {{ t(`catalog.levels.${record.snapshot.config.level}`) }}</h2>
        <dl class="result-detail__context">
          <div><dt>{{ t('play.bpm') }}</dt><dd>{{ record.snapshot.config.bpm }}</dd></div>
          <div><dt>{{ t('play.notesPlanned') }}</dt><dd>{{ record.snapshot.chart.notes.length }}</dd></div>
          <div><dt>{{ t('play.ruleProfile') }}</dt><dd>{{ record.snapshot.rules.id }}@{{ record.snapshot.rules.version }}</dd></div>
          <div><dt>{{ t('results.hitWindow') }}</dt><dd>-{{ record.snapshot.rules.hitWindow.earlyMs }}/+{{ record.snapshot.rules.hitWindow.lateMs }} ms</dd></div>
          <div><dt>{{ t('results.presentation') }}</dt><dd>{{ referenceLabel(storedRecord?.presentation ?? null) }}</dd></div>
          <div><dt>{{ t('results.gameEdition') }}</dt><dd>{{ referenceLabel(storedRecord?.gameEdition ?? null) }}</dd></div>
          <div><dt>{{ t('results.generator') }}</dt><dd>{{ record.snapshot.chart.generator.id }}@{{ record.snapshot.chart.generator.version }}</dd></div>
          <div><dt>{{ t('play.profile') }}</dt><dd>{{ record.snapshot.device.label }} · {{ record.snapshot.device.kind }} · {{ record.snapshot.device.id }}@{{ record.snapshot.device.version }}</dd></div>
          <div><dt>{{ t('play.calibration') }}</dt><dd>{{ record.snapshot.calibration.id }}@{{ record.snapshot.calibration.version }} · {{ t(`results.calibrationMethod.${record.snapshot.calibration.method}`) }}</dd></div>
          <div><dt>{{ t('results.calibrationOffsets') }}</dt><dd>{{ signed(record.snapshot.calibration.judgmentOffsetMs) }} ms / {{ signed(record.snapshot.calibration.visualOffsetMs) }} ms</dd></div>
          <div><dt>{{ t('results.attemptCondition') }}</dt><dd>{{ conditionLabel }}</dd></div>
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
        <SessionAnalysisReport v-if="record.result.analysis" :report="record.result.analysis"
          @focus-segment="prepareFocusedTraining" />
        <FeedbackBanner v-else tone="error" :message="t('results.analysis.notPerformed')" />
        <SessionExecutionDetails v-if="executionDetails" :details="executionDetails" />
        <TrainingRecommendationCard v-if="adaptation.record && adaptation.record.sourceSessionId === record.snapshot.id"
          :record="adaptation.record" actionable :adaptive-limit-reached="adaptation.adaptiveLimitReached"
          @accept="applyHistoricalRecommendation('accept')" @adjust="applyHistoricalRecommendation('adjust')"
          @ignore="applyHistoricalRecommendation('ignore')" />

        <section class="result-comparison" aria-labelledby="result-comparison-title">
          <div>
            <p class="section-kicker">{{ t('results.comparison.eyebrow') }}</p>
            <h3 id="result-comparison-title">{{ t('results.comparison.title') }}</h3>
          </div>
          <p v-if="!comparison || comparison.status === 'none'" class="muted-text">{{ t('results.comparison.none') }}</p>
          <template v-else-if="comparison.status === 'compatible'">
            <p>{{ t('results.comparison.compatible') }}</p>
            <dl class="comparison-metrics">
              <div><dt>{{ t('results.comparison.accuracyDelta') }}</dt><dd>{{ ratioDeltaLabel(comparison.accuracyDelta) }}</dd></div>
              <div><dt>{{ t('results.comparison.timingDelta') }}</dt><dd>{{ timingDeltaLabel(comparison.timingAbsoluteDeltaMs) }}</dd></div>
            </dl>
            <q-btn flat no-caps :to="{ name: 'results', params: { id: comparison.candidateSessionId } }"
              :label="t('results.comparison.openPrevious')" />
          </template>
          <template v-else>
            <FeedbackBanner tone="error" :message="t('results.comparison.incompatible', {
              differences: comparison.differences.map((item) => t(`results.comparison.differences.${item}`)).join(', '),
            })" />
            <q-btn flat no-caps :to="{ name: 'results', params: { id: comparison.candidateSessionId } }"
              :label="t('results.comparison.openCandidate')" />
          </template>
        </section>

        <section class="result-recording" aria-labelledby="result-recording-title">
          <div>
            <h3 id="result-recording-title">{{ t('results.recording.title') }}</h3>
            <p>{{ t('results.recording.exerciseReplay') }}</p>
            <p>{{ t(detailedExecutionAvailable ? 'results.recording.complete' : 'results.recording.summaryOnly') }}</p>
          </div>
          <span class="status-tag" :class="{ 'status-tag--subtle': !detailedExecutionAvailable }">
            {{ t(detailedExecutionAvailable ? 'results.recording.detailAvailable' : 'results.recording.detailUnavailable') }}
          </span>
        </section>

        <div class="result-detail__actions">
          <q-btn unelevated color="primary" no-caps icon="replay" :label="t('results.repeatChart')" @click="prepareRepeat" />
          <q-btn outline no-caps icon="tune" :to="{ name: 'play' }" :label="t('results.backToConfiguration')" />
          <q-btn outline no-caps :to="{ name: 'train' }" :label="t('common.browseCatalog')" />
          <q-btn outline no-caps icon="download" :disable="!storedRecord" :label="t('results.exportJson')" @click="exportJson" />
          <q-btn flat no-caps color="negative" icon="delete_outline" :disable="!storedRecord"
            :label="t('results.remove')" @click="confirmRemoval" />
        </div>
      </section>
    </template>

    <PageState v-else heading="h1" icon="receipt_long" :title="t('results.missingTitle')" :description="t('results.missingDescription')">
      <q-btn unelevated color="primary" no-caps :to="{ name: 'play' }" :label="t('results.backToConfiguration')" />
      <q-btn outline no-caps :to="{ name: 'train' }" :label="t('common.browseCatalog')" />
    </PageState>

    <q-dialog v-model="removeDialog">
      <q-card class="result-remove-dialog">
        <q-card-section>
          <h2>{{ t('results.removeTitle') }}</h2>
          <p>{{ t('results.removeDescription') }}</p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps :label="t('results.cancel')" @click="removeDialog = false" />
          <q-btn unelevated no-caps color="negative" :loading="removing"
            :label="t('results.removeConfirm')" @click="removeSession" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </PageFrame>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import type { RatioMetric, VersionedReference } from '@/engine/domain';
import { buildSessionExecutionDetails } from '@/engine/reporting';
import { useHistoryStore } from '@/stores/history';
import { useAdaptationStore } from '@/stores/adaptation';
import { useTrainingStore } from '@/stores/training';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import PageState from '@/components/PageState.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';
import ChartPreview from '@/components/training/ChartPreview.vue';
import SessionAnalysisReport from '@/components/reports/SessionAnalysisReport.vue';
import TrainingRecommendationCard from '@/components/reports/TrainingRecommendationCard.vue';
import SessionExecutionDetails from '@/components/reports/SessionExecutionDetails.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const workspace = useTrainingStore();
const history = useHistoryStore();
const adaptation = useAdaptationStore();
const removeDialog = ref(false);
const removing = ref(false);
const removalFailed = ref(false);
const routeId = computed(() => String(route.params.id ?? ''));
const record = computed(() => {
  const latest = workspace.latestRecord;
  if (latest?.snapshot.id === routeId.value) return latest;
  return history.selectedRecord?.id === routeId.value ? history.selectedRecord : null;
});
const storedRecord = computed(() => history.selectedRecord?.id === routeId.value ? history.selectedRecord : null);
const detailedExecutionAvailable = computed(() => storedRecord.value?.retainedEvents.status === 'complete');
const comparison = computed(() => history.comparisonForId === routeId.value ? history.comparison : null);
const executionDetails = computed(() => {
  const current = record.value;
  const stored = storedRecord.value;
  if (!current) return null;
  return buildSessionExecutionDetails({
    snapshot: current.snapshot,
    result: current.result,
    presentation: stored?.presentation ?? null,
    gameEdition: stored?.gameEdition ?? null,
    judgments: stored?.retainedEvents.status === 'complete' ? stored.retainedEvents.judgments : null,
  });
});
const hasSustains = computed(() => record.value?.snapshot.chart.notes.some((note) => note.durationTicks > 0) ?? false);
const timingLabel = computed(() => {
  const timing = record.value?.result.metrics.timing;
  if (timing?.status !== 'available') return t('play.unavailable');
  const rounded = Math.round(timing.meanErrorMs);
  return `${rounded > 0 ? '+' : ''}${rounded} ms`;
});
const conditionLabel = computed(() => {
  const current = record.value;
  if (!current) return '';
  const reasons = current.result.progression.eligible ? [] : current.result.progression.reasons
    .map((reason) => t(`results.progressionReasons.${reason}`));
  return [t(`play.ending.${current.result.ending.state}`),
    current.result.interruptions.length ? t('play.interruptions', { count: current.result.interruptions.length }) : null,
    ...reasons].filter(Boolean).join(' · ');
});

function ratioLabel(metric: RatioMetric): string {
  return metric.status === 'available' ? `${Math.round(metric.value * 100)}%` : t('play.unavailable');
}

function signed(value: number): string { return value > 0 ? `+${value}` : String(value); }

function referenceLabel(reference: VersionedReference | null): string {
  return reference ? `${reference.id}@${reference.version}` : t('results.notRecorded');
}

function ratioDeltaLabel(value: number | null): string {
  if (value === null) return t('play.unavailable');
  const points = Math.round(value * 1000) / 10;
  return t('results.comparison.percentagePoints', { value: signed(points) });
}

function timingDeltaLabel(value: number | null): string {
  return value === null ? t('play.unavailable') : t('results.comparison.milliseconds', { value: signed(Math.round(value)) });
}

async function prepareRepeat(): Promise<void> {
  const current = record.value;
  if (!current) return;
  workspace.prepareSavedSession(current.snapshot);
  await router.push({ name: 'play' });
}

async function prepareFocusedTraining(segmentId: string): Promise<void> {
  const current = record.value;
  if (!current) return;
  const focusSegment = segmentId.split(':').slice(2).join(':');
  if (!focusSegment) return;
  workspace.prepareSavedSession(current.snapshot, focusSegment);
  await router.push({ name: 'play' });
}

async function applyHistoricalRecommendation(action: 'accept' | 'adjust' | 'ignore'): Promise<void> {
  const current = record.value;
  if (!current) return;
  if (action === 'ignore') {
    await adaptation.ignore();
    return;
  }
  const config = action === 'accept' ? await adaptation.accept() : await adaptation.adjust();
  if (!config) return;
  workspace.prepareConfig(config, current.snapshot);
  await router.push({ name: 'play' });
}

function loadRecord(): void {
  if (routeId.value) {
    void history.openSession(routeId.value);
    void adaptation.loadForSession(routeId.value);
  }
}

function exportJson(): void {
  const stored = storedRecord.value;
  const exported = history.exportSelected();
  if (!stored || !exported) return;
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fretsense-session-${stored.id.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function confirmRemoval(): void {
  removalFailed.value = false;
  removeDialog.value = true;
}

async function removeSession(): Promise<void> {
  const id = routeId.value;
  if (!id || removing.value) return;
  removing.value = true;
  const removed = await history.removeSession(id);
  removing.value = false;
  if (!removed) {
    removalFailed.value = true;
    removeDialog.value = false;
    return;
  }
  workspace.discardResult(id);
  removeDialog.value = false;
  await router.replace({ name: 'history' });
}

onMounted(loadRecord);
watch(routeId, loadRecord);
</script>

<style scoped>
.result-detail { display: grid; gap: 24px; }
.result-detail h2 { margin: 0; }
.result-detail__context, .result-detail__metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
.result-detail__context > div, .result-detail__metrics > div { min-width: 0; padding: 14px; border: 1px solid var(--fs-border); border-radius: 10px; }
.result-detail dt, .result-detail__metrics span { color: var(--fs-muted); font-size: .75rem; }
.result-detail dd { margin: 3px 0 0; overflow-wrap: anywhere; font-weight: 700; }
.result-detail__metrics span, .result-detail__metrics strong { display: block; }
.result-recording { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 18px; border: 1px solid var(--fs-border); border-radius: 10px; background: var(--fs-raised); }
.result-recording h3 { margin: 0 0 8px; }
.result-recording p { margin: 0; color: var(--fs-muted); font-size: .875rem; }
.result-detail__actions { display: flex; flex-wrap: wrap; gap: 10px; }
.result-comparison { display: grid; gap: 14px; padding: 18px; border: 1px solid var(--fs-border); border-radius: 10px; }
.result-comparison h3, .result-comparison p { margin: 0; }
.section-kicker { margin: 0 0 4px; color: var(--q-primary); font-size: .75rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.comparison-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 0; }
.comparison-metrics > div { padding: 12px; border: 1px solid var(--fs-border); border-radius: 8px; }
.comparison-metrics dt { color: var(--fs-muted); font-size: .75rem; }
.comparison-metrics dd { margin: 3px 0 0; font-weight: 700; }
.result-remove-dialog { width: min(100%, 520px); }
.result-remove-dialog h2 { margin: 0 0 12px; }
.result-remove-dialog p { margin: 0; color: var(--fs-muted); }
@media (max-width: 700px) { .result-detail__context, .result-detail__metrics { grid-template-columns: 1fr; } .result-recording { flex-direction: column; } }
</style>
