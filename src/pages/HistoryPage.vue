<template>
  <PageFrame>
    <PageHeading :eyebrow="t('history.eyebrow')" :title="t('history.title')" :description="t('history.description')">
      <template #actions>
        <span class="status-tag">{{ t('history.count', { count: history.total }) }}</span>
      </template>
    </PageHeading>

    <FeedbackBanner
      v-if="history.storageState.mode === 'memory' || history.storageState.issue"
      tone="error"
      :message="storageMessage"
    >
      <template v-if="history.storageState.mode === 'memory'" #actions>
        <q-btn flat no-caps :label="t('history.retryStorage')" @click="history.retryStorage()" />
      </template>
    </FeedbackBanner>

    <section class="surface-card history-filters" aria-labelledby="history-filter-title">
      <div>
        <h2 id="history-filter-title">{{ t('history.filters.title') }}</h2>
        <p class="muted-text">{{ t('history.filters.description') }}</p>
      </div>
      <q-select v-model="history.techniqueFilter" outlined clearable emit-value map-options
        :label="t('history.filters.technique')" :options="techniqueOptions" @update:model-value="filtersChanged" />
      <q-select v-model="history.levelFilter" outlined clearable emit-value map-options
        :label="t('history.filters.level')" :options="levelOptions" @update:model-value="filtersChanged" />
      <q-select v-model="history.modeFilter" outlined clearable emit-value map-options
        :label="t('history.filters.mode')" :options="modeOptions" @update:model-value="filtersChanged" />
      <q-select v-model="history.endingFilter" outlined clearable emit-value map-options
        :label="t('history.filters.ending')" :options="endingOptions" @update:model-value="filtersChanged" />
      <q-input v-model="history.dateFromFilter" outlined clearable type="date"
        :label="t('history.filters.dateFrom')" @update:model-value="filtersChanged" />
      <q-input v-model="history.dateToFilter" outlined clearable type="date"
        :label="t('history.filters.dateTo')" @update:model-value="filtersChanged" />
    </section>

    <FeedbackBanner v-if="dateRangeInvalid" class="section-spacing" tone="error" :message="t('history.filters.invalidPeriod')" />
    <FeedbackBanner v-if="history.incompatibleCount" class="section-spacing" tone="error"
      :message="t('history.incompatible', { count: history.incompatibleCount })" />
    <FeedbackBanner v-if="history.error" class="section-spacing" tone="error" :message="t('history.loadError')" />

    <div class="history-content" aria-live="polite" :aria-busy="history.loading">
      <q-inner-loading :showing="history.loading" :label="t('history.loading')" />
      <PageState v-if="!history.loading && history.records.length === 0" icon="history"
        :title="t(hasFilters ? 'history.noMatchesTitle' : 'history.stateTitle')"
        :description="t(hasFilters ? 'history.noMatchesDescription' : 'history.stateDescription')">
        <q-btn v-if="hasFilters" unelevated color="primary" no-caps :label="t('history.clearFilters')" @click="clearFilters" />
        <q-btn v-else unelevated color="primary" no-caps :to="{ name: 'train' }" :label="t('common.browseCatalog')" />
      </PageState>

      <ol v-else class="history-list">
        <li v-for="record in history.records" :key="record.id" class="surface-card history-record">
          <div class="history-record__main">
            <div class="card-topline">
              <span class="status-tag">{{ t(`play.ending.${record.endingState}`) }}</span>
              <time :datetime="record.endedAtIso">{{ dateLabel(record.endedAtIso) }}</time>
            </div>
            <h2>{{ t(`techniques.${record.technique}.title`) }} · {{ t(`catalog.levels.${record.level}`) }}</h2>
            <p class="muted-text">{{ t(`play.mode.${record.mode}`) }} · {{ record.bpm }} BPM · {{ t('history.hits', { hits: record.hitNotes, total: record.plannedNotes }) }}</p>
          </div>
          <div class="history-record__result">
            <span>{{ t('play.accuracy') }}</span>
            <strong>{{ record.accuracy === null ? t('play.unavailable') : `${Math.round(record.accuracy * 100)}%` }}</strong>
          </div>
          <q-btn outline no-caps icon-right="arrow_forward" :to="{ name: 'results', params: { id: record.id } }"
            :label="t('history.open')" />
        </li>
      </ol>
    </div>

    <nav v-if="history.total > history.pageSize" class="history-pagination" :aria-label="t('history.pagination')">
      <q-pagination v-model="history.page" :max="history.pageCount" direction-links boundary-links
        @update:model-value="history.loadPage()" />
    </nav>

    <FeedbackBanner v-if="history.evolutionError" class="section-spacing" tone="error" :message="t('history.evolution.loadError')" />
    <EvolutionPanel v-else-if="history.evolution" :dashboard="history.evolution" />
  </PageFrame>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { TECHNIQUE_DESCRIPTORS } from '@/catalog';
import { useHistoryStore } from '@/stores/history';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import PageState from '@/components/PageState.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';
import EvolutionPanel from '@/components/reports/EvolutionPanel.vue';

const { t, locale } = useI18n();
const history = useHistoryStore();
const techniqueOptions = computed(() => TECHNIQUE_DESCRIPTORS.map(({ id }) => ({
  value: id,
  label: t(`techniques.${id}.title`),
})));
const modeOptions = computed(() => ['practice', 'assessment'].map((value) => ({
  value,
  label: t(`play.mode.${value}`),
}))); 
const levelOptions = computed(() => ['beginner', 'intermediate', 'advanced'].map((value) => ({
  value,
  label: t(`catalog.levels.${value}`),
})));
const endingOptions = computed(() => ['completed', 'aborted'].map((value) => ({
  value,
  label: t(`play.ending.${value}`),
})));
const storageMessage = computed(() => t(`history.storage.${history.storageState.issue ?? history.storageState.mode}`));
const hasFilters = computed(() => Boolean(history.techniqueFilter || history.levelFilter || history.modeFilter
  || history.endingFilter || history.dateFromFilter || history.dateToFilter));
const dateRangeInvalid = computed(() => Boolean(history.dateFromFilter && history.dateToFilter
  && history.dateFromFilter > history.dateToFilter));

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function filtersChanged(): void {
  if (dateRangeInvalid.value) return;
  void history.loadPage(true);
}

function clearFilters(): void {
  history.techniqueFilter = null;
  history.levelFilter = null;
  history.modeFilter = null;
  history.endingFilter = null;
  history.dateFromFilter = null;
  history.dateToFilter = null;
  void history.loadPage(true);
}

onMounted(() => { void history.loadPage(); });
</script>

<style scoped>
.history-filters { display: grid; grid-template-columns: repeat(3, minmax(170px, 1fr)); gap: 16px; align-items: center; }
.history-filters > div:first-child { grid-column: 1 / -1; }
.history-filters h2 { margin-top: 0; }
.history-filters p { margin-bottom: 0; }
.history-content { position: relative; min-height: 180px; margin-top: 24px; }
.history-list { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
.history-record { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 24px; padding-block: 20px; }
.history-record h2 { margin: 12px 0 4px; }
.history-record p { margin: 0; }
.history-record time { color: var(--fs-muted); font-size: .8rem; }
.history-record__result { min-width: 90px; text-align: right; }
.history-record__result span, .history-record__result strong { display: block; }
.history-record__result span { color: var(--fs-muted); font-size: .75rem; }
.history-record__result strong { font-size: 1.3rem; }
.history-pagination { display: flex; justify-content: center; margin-top: 28px; }
@media (max-width: 900px) {
  .history-filters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 599px) {
  .history-filters, .history-record { grid-template-columns: minmax(0, 1fr); }
  .history-record__result { text-align: left; }
  .history-record .q-btn { justify-self: stretch; }
}
</style>
