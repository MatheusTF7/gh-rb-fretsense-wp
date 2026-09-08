<template>
  <section class="analysis-report" aria-labelledby="analysis-title">
    <div class="analysis-report__heading">
      <div>
        <p class="section-kicker">{{ t('results.analysis.eyebrow') }}</p>
        <h2 id="analysis-title">{{ t('results.analysis.title') }}</h2>
      </div>
      <span class="status-tag">{{ t(`results.analysis.status.${report.status}`) }}</span>
    </div>

    <FeedbackBanner v-if="report.status === 'partial'" tone="error"
      :message="t('results.analysis.partial', { limitations: limitationLabels })" />

    <div class="analysis-report__metrics">
      <div><span>{{ t('results.analysis.timing.mean') }}</span><strong>{{ signedTiming(timingMetric('meanErrorMs')) }}</strong></div>
      <div><span>{{ t('results.analysis.timing.absolute') }}</span><strong>{{ timingValue(timingMetric('meanAbsoluteErrorMs')) }}</strong></div>
      <div><span>{{ t('results.analysis.timing.dispersion') }}</span><strong>{{ timingValue(timingMetric('populationStdDevMs')) }}</strong></div>
      <div><span>{{ t('results.analysis.samples') }}</span><strong>{{ timingSampleCount }}</strong></div>
    </div>

    <div v-if="report.diagnostics.length" class="analysis-report__section">
      <h3>{{ t('results.analysis.diagnosticsTitle') }}</h3>
      <ul class="diagnostic-list">
        <li v-for="diagnostic in report.diagnostics" :key="diagnostic.id">
          <strong>{{ t(`results.analysis.diagnostics.${diagnostic.code}`) }}</strong>
          <span>{{ t(`results.analysis.basis.${diagnostic.basis}`) }} · {{ t('results.analysis.occurrences', {
            count: diagnostic.occurrences, samples: diagnostic.sampleCount
          }) }}</span>
          <small v-if="diagnostic.evidence.length">{{ evidenceLabel(diagnostic) }}</small>
        </li>
      </ul>
    </div>
    <p v-else class="muted-text">{{ t('results.analysis.noDiagnostics') }}</p>

    <div class="analysis-report__section">
      <h3>{{ t('results.analysis.fretsTitle') }}</h3>
      <div class="table-scroll">
        <q-markup-table flat bordered separator="cell">
          <thead><tr><th>{{ t('results.analysis.fret') }}</th><th>{{ t('results.analysis.accuracy') }}</th><th>{{ t('results.analysis.unexpected') }}</th></tr></thead>
          <tbody>
            <tr v-for="metric in visibleFrets" :key="metric.fret">
              <th scope="row">{{ metric.fret }} · {{ t(`frets.${metric.fret}`) }}</th>
              <td>{{ ratioLabel(metric.accuracy) }}</td>
              <td>{{ metric.unexpectedCount }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </div>
    </div>

    <div v-if="report.transitionAccuracy.length" class="analysis-report__section">
      <h3>{{ t('results.analysis.transitionsTitle') }}</h3>
      <div class="table-scroll">
        <q-markup-table flat bordered separator="cell">
          <thead><tr><th>{{ t('results.analysis.transition') }}</th><th>{{ t('results.analysis.accuracy') }}</th></tr></thead>
          <tbody>
            <tr v-for="metric in report.transitionAccuracy" :key="`${metric.from}-${metric.to}`">
              <th scope="row">{{ fretMaskLabel(metric.from) }} → {{ fretMaskLabel(metric.to) }}</th>
              <td>{{ ratioLabel(metric.accuracy) }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </div>
    </div>

    <div class="analysis-report__metrics">
      <div><span>{{ t('results.analysis.chords') }}</span><strong>{{ ratioLabel(report.chords.accuracy) }}</strong></div>
      <div><span>{{ t('results.analysis.chordIncomplete') }}</span><strong>{{ report.chords.incompleteCount }}</strong></div>
      <div><span>{{ t('results.analysis.chordExtra') }}</span><strong>{{ report.chords.extraFretsCount }}</strong></div>
      <div><span>{{ t('results.analysis.chordSubstitution') }}</span><strong>{{ report.chords.substitutionCount }}</strong></div>
      <div><span>{{ t('results.analysis.chordOmitted') }}</span><strong>{{ report.chords.omittedCount }}</strong></div>
      <div><span>{{ t('results.analysis.sustainDuration') }}</span><strong>{{ sustainLabel }}</strong></div>
      <div v-for="metric in report.strumDirection" :key="metric.direction">
        <span>{{ t(`results.analysis.direction.${metric.direction}`) }}</span><strong>{{ ratioLabel(metric.compliance) }}</strong>
      </div>
    </div>

    <div class="analysis-report__section">
      <h3>{{ t('results.analysis.byTechnique') }}</h3>
      <div class="table-scroll">
        <table class="analysis-table">
          <thead><tr><th>{{ t('results.analysis.slice') }}</th><th>{{ t('results.analysis.accuracy') }}</th><th>{{ t('results.analysis.timing.mean') }}</th><th>{{ t('results.analysis.diagnosticsCount') }}</th></tr></thead>
          <tbody>
            <tr v-for="slice in report.techniques" :key="slice.id">
              <th scope="row">{{ t(`techniques.${slice.technique}.title`) }}</th>
              <td>{{ ratioLabel(slice.noteAccuracy) }}</td>
              <td>{{ sliceTimingLabel(slice) }}</td>
              <td>{{ slice.diagnosticIds.length }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="analysis-report__section">
      <h3>{{ t('results.analysis.bySegment') }}</h3>
      <div class="table-scroll">
        <table class="analysis-table">
          <thead><tr><th>{{ t('results.analysis.slice') }}</th><th>{{ t('results.analysis.accuracy') }}</th><th>{{ t('results.analysis.timing.mean') }}</th><th>{{ t('results.analysis.diagnosticsCount') }}</th></tr></thead>
          <tbody>
            <tr v-for="slice in report.segments" :key="slice.id">
              <th scope="row">{{ slice.id }}</th>
              <td>{{ ratioLabel(slice.noteAccuracy) }}</td>
              <td>{{ sliceTimingLabel(slice) }}</td>
              <td>{{ slice.diagnosticIds.length }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="muted-text analysis-report__policy">
      {{ t('results.analysis.policy', {
        policy: `${report.policy.id}@${report.policy.version}`,
        notes: report.analyzedNotes,
        inputs: report.analyzedInputs,
        distance: report.alignment.maximumDistanceMs,
      }) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AnalysisSlice, FretMask, RatioMetric, SessionAnalysisReport, TrainingDiagnostic } from '@/engine/domain';
import { FRET_BITS } from '@/engine/domain';
import FeedbackBanner from '@/components/FeedbackBanner.vue';

const props = defineProps<{ report: SessionAnalysisReport }>();
const { t } = useI18n();

function unavailableLabel(metric: Extract<RatioMetric, { status: 'unavailable' }>): string {
  return t(`results.analysis.unavailable.${metric.reason}`);
}

function ratioLabel(metric: RatioMetric): string {
  return metric.status === 'available'
    ? `${Math.round(metric.value * 100)}% (${metric.numerator}/${metric.denominator})`
    : unavailableLabel(metric);
}

function fretMaskLabel(mask: FretMask): string {
  const labels = (Object.entries(FRET_BITS) as [keyof typeof FRET_BITS, number][])
    .filter(([, bit]) => (mask & bit) !== 0).map(([fret]) => fret);
  return labels.length ? labels.join('+') : '—';
}

const visibleFrets = computed(() => props.report.fretAccuracy.filter((metric) =>
  metric.accuracy.status === 'available' || metric.unexpectedCount > 0));
const timingSampleCount = computed(() => props.report.timing.status === 'available'
  ? props.report.timing.sampleCount : t(`results.analysis.unavailable.${props.report.timing.reason}`));
const limitationLabels = computed(() => props.report.limitations
  .map((limitation) => t(`results.analysis.limitations.${limitation}`)).join('; '));
const sustainLabel = computed(() => props.report.sustainDuration.status === 'available'
  ? `${Math.round(props.report.sustainDuration.value * 100)}% (${Math.round(props.report.sustainDuration.numerator)}/${Math.round(props.report.sustainDuration.denominator)} ms)`
  : t(`results.analysis.unavailable.${props.report.sustainDuration.reason}`));

function timingMetric(key: 'meanErrorMs' | 'meanAbsoluteErrorMs' | 'populationStdDevMs'): number | null {
  return props.report.timing.status === 'available' ? props.report.timing[key] : null;
}

function timingValue(value: number | null): string {
  return value === null
    ? t(`results.analysis.unavailable.${props.report.timing.status === 'unavailable' ? props.report.timing.reason : 'no-samples'}`)
    : `${Math.round(value)} ms`;
}

function signedTiming(value: number | null): string {
  if (value === null) return timingValue(value);
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded} ms`;
}

function evidenceLabel(diagnostic: TrainingDiagnostic): string {
  const item = diagnostic.evidence[0];
  if (!item) return '';
  return t('results.analysis.evidence', {
    notes: item.noteIds.map((id) => id.split(':note:').at(-1) ?? id).join(', ') || '—',
    inputs: item.inputSequences.join(', ') || '—',
    judgments: item.judgmentSequences.join(', ') || '—',
  });
}

function sliceTimingLabel(slice: AnalysisSlice): string {
  return slice.timing.status === 'available' ? signedTiming(slice.timing.meanErrorMs)
    : t(`results.analysis.unavailable.${slice.timing.reason}`);
}
</script>

<style scoped>
.analysis-report { display: grid; gap: 22px; padding-top: 8px; border-top: 1px solid var(--fs-border); }
.analysis-report__heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
.analysis-report__heading h2, .analysis-report__section h3 { margin: 0; }
.section-kicker { margin: 0 0 4px; color: var(--q-primary); font-size: .75rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.analysis-report__metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.analysis-report__metrics > div { min-width: 0; padding: 14px; border: 1px solid var(--fs-border); border-radius: 10px; }
.analysis-report__metrics span, .analysis-report__metrics strong { display: block; }
.analysis-report__metrics span { color: var(--fs-muted); font-size: .75rem; }
.analysis-report__section { display: grid; gap: 12px; }
.diagnostic-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.diagnostic-list li { display: grid; gap: 3px; padding: 12px 14px; border-left: 3px solid var(--q-primary); background: color-mix(in srgb, var(--q-primary) 8%, transparent); }
.diagnostic-list span, .diagnostic-list small { color: var(--fs-muted); font-size: .82rem; }
.table-scroll { max-width: 100%; overflow-x: auto; }
.analysis-table { width: 100%; border-collapse: collapse; }
.analysis-table th, .analysis-table td { padding: 10px 12px; border: 1px solid var(--fs-border); text-align: left; }
.analysis-table thead th { color: var(--fs-muted); font-size: .75rem; }
.analysis-report__policy { margin: 0; }
@media (max-width: 700px) { .analysis-report__metrics { grid-template-columns: 1fr; } }
</style>
