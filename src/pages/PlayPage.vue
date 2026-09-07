<template>
  <PageFrame class="practice-page">
    <PageHeading :eyebrow="t('navigation.play')" :title="t('play.title')" :description="t('play.description')">
      <template #actions><span class="status-tag">{{ t('common.planned') }}</span></template>
    </PageHeading>
    <section class="training-surface" :aria-label="t('navigation.play')">
      <PageState icon="queue_music" :title="t('play.stateTitle')" :description="t('play.stateDescription')">
        <q-btn unelevated color="primary" no-caps :to="{ name: 'train' }" :label="t('common.backCatalog')" />
      </PageState>
      <div class="training-lanes">
        <FretLegend />
        <p class="muted-text">{{ t('play.laneCaption') }}</p>
      </div>
    </section>
    <p class="muted-text practice-caption">{{ t('play.footer') }}</p>
  </PageFrame>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import PageState from '@/components/PageState.vue';
import FretLegend from '@/components/training/FretLegend.vue';

const { t } = useI18n();
</script>
