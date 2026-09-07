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
          <span class="status-tag" :class="{ 'status-tag--subtle': !availableTechniques.has(technique.id) }">
            {{ t(availableTechniques.has(technique.id) ? 'common.available' : 'common.planned') }}
          </span>
        </div>
        <h2>{{ t(`techniques.${technique.id}.title`) }}</h2>
        <p>{{ t(`techniques.${technique.id}.description`) }}</p>
        <p class="technique-focus">{{ t(`techniques.${technique.id}.focus`) }}</p>
        <q-btn
          v-if="availableTechniques.has(technique.id)"
          flat
          no-caps
          class="card-link"
          :to="{ name: 'play' }"
          :label="t('play.start')"
          icon-right="arrow_forward"
        />
      </article>
    </div>
    <PageState v-else icon="search_off" :title="t('catalog.emptyTitle')" :description="t('catalog.emptyDescription')">
      <q-btn unelevated color="primary" no-caps :label="t('common.clearSearch')" @click="clearSearch" />
    </PageState>
  </PageFrame>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { QInput } from 'quasar';
import type { Technique } from '@/engine/domain';
import { useInterfaceStore } from '@/stores/interface';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';
import PageState from '@/components/PageState.vue';

const { t } = useI18n();
const ui = useInterfaceStore();
const searchInput = ref<QInput | null>(null);
const techniques: readonly { id: Technique; icon: string }[] = [
  { id: 'single-strum', icon: 'south' },
  { id: 'alternate-strum', icon: 'swap_vert' },
  { id: 'hopo', icon: 'timeline' },
  { id: 'tapping', icon: 'touch_app' },
  { id: 'sequences', icon: 'route' },
  { id: 'chords', icon: 'piano' },
  { id: 'sustains', icon: 'horizontal_rule' },
  { id: 'mixed', icon: 'shuffle' },
];
const availableTechniques = new Set<Technique>(['single-strum', 'tapping', 'sequences', 'chords']);

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

const visibleTechniques = computed(() => {
  const query = normalizeSearch(ui.catalogSearch);
  return techniques.filter(({ id }) =>
    normalizeSearch(
      `${id} ${t(`techniques.${id}.title`)} ${t(`techniques.${id}.description`)} ${t(`techniques.${id}.focus`)}`,
    ).includes(query),
  );
});

function clearSearch() {
  ui.catalogSearch = '';
  searchInput.value?.focus();
}
</script>
