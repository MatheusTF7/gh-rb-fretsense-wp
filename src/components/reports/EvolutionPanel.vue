<template>
  <section class="surface-card evolution-panel" aria-labelledby="evolution-title">
    <div class="evolution-heading">
      <div>
        <p class="eyebrow">{{ t('history.evolution.eyebrow') }}</p>
        <h2 id="evolution-title">{{ t('history.evolution.title') }}</h2>
        <p class="muted-text">{{ t('history.evolution.description', {
          count: dashboard.policy.minimumEvolutionAttempts,
          notes: dashboard.policy.minimumNotesPerAttempt,
        }) }}</p>
      </div>
      <span class="status-tag">{{ t('history.evolution.attempts', { count: dashboard.attemptCount }) }}</span>
    </div>

    <p v-if="dashboard.groups.length === 0" class="muted-text">{{ t('history.evolution.empty') }}</p>
    <div v-else class="evolution-groups">
      <q-expansion-item v-for="group in dashboard.groups" :key="group.id" class="evolution-group"
        :label="`${t(`techniques.${group.technique}.title`)} · ${t(`catalog.levels.${group.level}`)}`"
        :caption="t('history.evolution.groupCaption', { attempts: group.attemptCount, mode: t(`play.mode.${group.mode}`) })"
        expand-separator>
        <div class="evolution-group__body">
          <dl class="evolution-summary">
            <div><dt>{{ t('history.evolution.observedRange') }}</dt><dd>{{ group.minimumObservedBpm }}–{{ group.maximumObservedBpm }} BPM</dd></div>
            <div><dt>{{ t('history.evolution.consistentLimit') }}</dt><dd>{{ demonstratedLabel(group) }}</dd></div>
            <div><dt>{{ t('history.evolution.eligible') }}</dt><dd>{{ group.eligibleAttemptCount }}/{{ group.attemptCount }}</dd></div>
            <div><dt>{{ t('history.evolution.charts') }}</dt><dd>{{ group.distinctChartCount }}</dd></div>
          </dl>
          <p class="condition-line">{{ t('history.evolution.conditions', {
            pattern: referenceLabel(group.pattern), rule: referenceLabel(group.rule),
            window: `-${group.hitWindow.earlyMs}/+${group.hitWindow.lateMs} ms`,
            presentation: referenceLabel(group.presentation),
            edition: referenceLabel(group.gameEdition), calibration: calibrationLabel(group),
            device: referenceLabel(group.device),
          }) }}</p>
          <div class="table-scroll">
            <table class="evolution-table">
              <thead><tr><th>{{ t('history.evolution.date') }}</th><th>BPM</th><th>{{ t('history.evolution.chart') }}</th><th>{{ t('play.accuracy') }}</th><th>{{ t('history.evolution.condition') }}</th><th></th></tr></thead>
              <tbody>
                <tr v-for="point in group.points" :key="point.sessionId">
                  <th scope="row">{{ dateLabel(point.endedAtIso) }}</th>
                  <td>{{ point.bpm }}</td>
                  <td class="chart-id"><code>{{ point.chartId }}</code></td>
                  <td>{{ point.accuracy === null ? t('play.unavailable') : `${Math.round(point.accuracy * 100)}%` }}</td>
                  <td>{{ t(!point.eligible ? 'history.evolution.ineligible'
                    : !point.sampleSufficient ? 'history.evolution.insufficientAttempt'
                      : point.meetsGoals ? 'history.evolution.goalsMet' : 'history.evolution.goalsNotMet') }}</td>
                  <td><q-btn flat dense no-caps :to="{ name: 'results', params: { id: point.sessionId } }" :label="t('history.open')" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </q-expansion-item>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { REPORTING_POLICY, type EvolutionDashboard, type EvolutionGroup } from '@/engine/reporting';
import type { VersionedReference } from '@/engine/domain';

defineProps<{ dashboard: EvolutionDashboard }>();
const { t, locale } = useI18n();

function referenceLabel(reference: VersionedReference | null): string {
  return reference ? `${reference.id}@${reference.version}` : t('history.evolution.notRecorded');
}

function demonstratedLabel(group: EvolutionGroup): string {
  return group.demonstratedBpm.status === 'available'
    ? t('history.evolution.demonstrated', {
        bpm: group.demonstratedBpm.value,
        count: group.demonstratedBpm.supportingAttempts,
      })
    : t(`history.evolution.unavailable.${group.demonstratedBpm.reason}`, {
        count: group.demonstratedBpm.observedAttempts,
        required: REPORTING_POLICY.minimumEvolutionAttempts,
      });
}

function calibrationLabel(group: EvolutionGroup): string {
  const value = group.calibration;
  const signed = (offset: number) => `${offset > 0 ? '+' : ''}${offset}`;
  return t('history.evolution.calibrationCondition', {
    method: t(`results.calibrationMethod.${value.method}`),
    judgment: signed(value.judgmentOffsetMs),
    visual: signed(value.visualOffsetMs),
    audio: t(value.audioMode === 'enabled' ? 'play.audioEnabled' : 'play.audioSilent'),
  });
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(value));
}
</script>

<style scoped>
.evolution-panel { display: grid; gap: 20px; margin-top: 28px; }
.evolution-heading { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
.evolution-heading h2 { margin: 0; }
.evolution-heading p:last-child { margin-bottom: 0; }
.evolution-groups { display: grid; gap: 10px; }
.evolution-group { border: 1px solid var(--fs-border); border-radius: 10px; background: var(--fs-raised); }
.evolution-group__body { display: grid; gap: 16px; padding: 4px 16px 18px; }
.evolution-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 0; }
.evolution-summary > div { padding: 12px; border: 1px solid var(--fs-border); border-radius: 8px; }
.evolution-summary dt { color: var(--fs-muted); font-size: .75rem; }
.evolution-summary dd { margin: 3px 0 0; font-weight: 700; }
.condition-line { margin: 0; color: var(--fs-muted); font-size: .8rem; overflow-wrap: anywhere; }
.table-scroll { max-width: 100%; overflow-x: auto; }
.evolution-table { width: 100%; border-collapse: collapse; }
.evolution-table th, .evolution-table td { padding: 9px 10px; border-bottom: 1px solid var(--fs-border); text-align: left; }
.evolution-table thead th { color: var(--fs-muted); font-size: .75rem; }
.chart-id { max-width: 240px; overflow-wrap: anywhere; font-size: .75rem; }
@media (max-width: 700px) { .evolution-heading { flex-direction: column; } .evolution-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 440px) { .evolution-summary { grid-template-columns: 1fr; } }
</style>
