<template>
  <PageFrame>
    <section class="home-hero">
      <div class="hero-copy">
        <p class="eyebrow">{{ t('home.eyebrow') }}</p>
        <h1>{{ t('home.title') }}</h1>
        <p class="hero-description">{{ t('home.description') }}</p>
        <div class="hero-actions">
          <q-btn unelevated color="primary" no-caps :to="{ name: 'train' }" :label="t('common.browseCatalog')" icon-right="arrow_forward" />
          <q-btn flat no-caps :to="{ name: 'devices' }" :label="t('common.viewDevices')" />
        </div>
      </div>
      <aside class="hero-guide" aria-labelledby="fret-guide-title">
        <div class="hero-guide__decoration" aria-hidden="true">
          <span v-for="fret in frets" :key="fret" :data-fret="fret" />
        </div>
        <h2 id="fret-guide-title">{{ t('home.fretTitle') }}</h2>
        <p>{{ t('home.fretDescription') }}</p>
        <FretLegend />
      </aside>
    </section>

    <FeedbackBanner :message="t('home.notice')" />

    <section class="section-spacing" aria-labelledby="explore-title">
      <h2 id="explore-title" class="section-title">{{ t('home.stepsTitle') }}</h2>
      <div class="card-grid">
        <article v-for="card in cards" :key="card.id" class="surface-card feature-card">
          <q-icon :name="card.icon" class="card-icon" aria-hidden="true" />
          <h3>{{ t(`home.${card.id}Title`) }}</h3>
          <p>{{ t(`home.${card.id}Description`) }}</p>
          <q-btn flat no-caps :to="{ name: card.route }" :label="t(card.action)" icon-right="arrow_forward" class="card-link" />
        </article>
      </div>
    </section>
  </PageFrame>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PageFrame from '@/components/PageFrame.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';
import FretLegend from '@/components/training/FretLegend.vue';

const { t } = useI18n();
const frets = ['G', 'R', 'Y', 'B', 'O'] as const;
const cards = [
  { id: 'catalog', icon: 'grid_view', route: 'train', action: 'common.browseCatalog' },
  { id: 'devices', icon: 'sports_esports', route: 'devices', action: 'common.viewDevices' },
  { id: 'settings', icon: 'tune', route: 'settings', action: 'common.viewSettings' },
] as const;
</script>
