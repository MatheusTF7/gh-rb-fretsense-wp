<template>
  <PageFrame>
    <PageHeading :eyebrow="t('catalog.eyebrow')" :title="t('catalog.title')" :description="t('catalog.description')">
      <template #actions>
        <q-btn outline no-caps :to="{ name: 'play' }" :label="t('common.viewPractice')" icon-right="arrow_forward" />
      </template>
    </PageHeading>
    <FeedbackBanner :message="t('catalog.notice')" />

    <div class="catalog-toolbar">
      <q-input
        ref="searchInput"
        v-model="ui.catalogSearch"
        outlined
        type="search"
        :label="t('catalog.search')"
        maxlength="120"
        autocomplete="off"
        aria-describedby="catalog-count"
      >
        <template #prepend><q-icon name="search" aria-hidden="true" /></template>
        <template v-if="ui.catalogSearch" #append>
          <q-btn flat round size="sm" icon="close" :aria-label="t('common.clearSearch')" @click="clearSearch" />
        </template>
      </q-input>
      <p id="catalog-count" class="muted-text" aria-live="polite">
        {{ t('catalog.count', visibleTechniques.length) }}
      </p>
    </div>

    <div v-if="visibleTechniques.length" class="card-grid technique-grid">
      <article v-for="technique in visibleTechniques" :key="technique.id" class="surface-card technique-card">
        <div class="card-topline">
          <q-icon :name="technique.icon" class="card-icon" aria-hidden="true" />
          <span class="status-tag">{{ t('catalog.presetCount', technique.presets.length) }}</span>
        </div>
        <h2>{{ t(`techniques.${technique.id}.title`) }}</h2>
        <p>{{ t(`techniques.${technique.id}.description`) }}</p>
        <p class="technique-objective"><strong>{{ t('catalog.objective') }}</strong> {{ t(technique.objectiveKey) }}</p>
        <ul class="preset-list">
          <li v-for="preset in technique.presets" :key="preset.id">
            <div>
              <span>{{ t(`catalog.levels.${preset.level}`) }}</span>
              <small>{{ preset.config.bpm }} BPM · {{ t('catalog.subdivision', { value: preset.config.subdivision }) }}</small>
            </div>
            <q-btn flat dense no-caps icon-right="arrow_forward" :to="{ name: 'play', query: { preset: preset.id } }"
              :label="t('catalog.configure')" />
          </li>
        </ul>
        <p class="technique-focus">{{ t(`techniques.${technique.id}.focus`) }}</p>
      </article>
    </div>
    <PageState v-else icon="search_off" :title="t('catalog.emptyTitle')" :description="t('catalog.emptyDescription')">
      <q-btn unelevated color="primary" no-caps :label="t('common.clearSearch')" @click="clearSearch" />
    </PageState>

    <ManualPatternEditor class="section-spacing" />
  </PageFrame>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QInput } from 'quasar';
import type { Technique } from '@/engine/domain';
import { DRILL_PRESETS, TECHNIQUE_DESCRIPTORS } from '@/catalog';
import { useInterfaceStore } from '@/stores/interface';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';
import PageState from '@/components/PageState.vue';
import ManualPatternEditor from '@/components/ManualPatternEditor.vue';

const { t } = useI18n();
const ui = useInterfaceStore();
const searchInput = ref<QInput | null>(null);
const techniqueIcons: Readonly<Record<Technique, string>> = {
  'single-strum': 'south',
  'alternate-strum': 'swap_vert',
  hopo: 'timeline',
  tapping: 'touch_app',
  sequences: 'route',
  chords: 'piano',
  sustains: 'horizontal_rule',
  mixed: 'shuffle',
};
const techniques = TECHNIQUE_DESCRIPTORS.map((descriptor) => ({
  ...descriptor,
  icon: techniqueIcons[descriptor.id],
  presets: DRILL_PRESETS.filter(({ technique }) => technique === descriptor.id),
}));

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const visibleTechniques = computed(() => {
  const query = normalizeSearch(ui.catalogSearch);
  return techniques.filter(({ id }) =>
    normalizeSearch(
      `${id} ${t(`techniques.${id}.title`)} ${t(`techniques.${id}.description`)} ${t(`techniques.${id}.focus`)} ${t(`techniques.${id}.objective`)}`,
    ).includes(query),
  );
});

function clearSearch() {
  ui.catalogSearch = '';
  searchInput.value?.focus();
}
</script>
