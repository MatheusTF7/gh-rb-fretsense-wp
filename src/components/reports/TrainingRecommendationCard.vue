<template>
  <section class="recommendation-card" aria-labelledby="recommendation-title">
    <div class="recommendation-card__heading">
      <div>
        <p class="eyebrow">{{ t('play.adaptation.eyebrow') }}</p>
        <h3 id="recommendation-title">{{ t('play.adaptation.title') }}</h3>
      </div>
      <span class="status-tag">{{ t(`play.adaptation.decisions.${record.decision}`) }}</span>
    </div>
    <p>{{ t(`play.adaptation.reasons.${recommendation.reason}`) }}</p>
    <dl>
      <div>
        <dt>{{ t('play.adaptation.evidence') }}</dt>
        <dd>{{ t('play.adaptation.sampleEvidence', {
          samples: recommendation.sampleCount, references: evidenceCount, source: record.sourceSessionId,
        }) }}</dd>
      </div>
      <div>
        <dt>{{ t('play.adaptation.consistency') }}</dt>
        <dd>{{ t('play.adaptation.attemptEvidence', {
          observed: recommendation.consistency.observedAttempts,
          required: recommendation.consistency.requiredAttempts,
        }) }}</dd>
      </div>
      <div>
        <dt>{{ t('play.adaptation.effect') }}</dt>
        <dd>{{ effect }}</dd>
      </div>
    </dl>
    <FeedbackBanner v-if="adaptiveLimitReached" tone="info" :message="t('play.adaptation.limitReached')" />
    <div v-if="actionable && record.decision === 'pending'" class="recommendation-card__actions">
      <q-btn unelevated color="primary" no-caps icon="check" :disable="adaptiveLimitReached"
        :label="t('play.adaptation.accept')" @click="emit('accept')" />
      <q-btn outline no-caps icon="tune" :label="t('play.adaptation.adjust')" @click="emit('adjust')" />
      <q-btn flat no-caps icon="close" :label="t('play.adaptation.ignore')" @click="emit('ignore')" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { StoredAdaptationRecord } from '@/platform/storage';
import FeedbackBanner from '@/components/FeedbackBanner.vue';

const props = withDefaults(defineProps<{
  record: StoredAdaptationRecord;
  actionable?: boolean;
  adaptiveLimitReached?: boolean;
}>(), { actionable: false, adaptiveLimitReached: false });
const emit = defineEmits<{ accept: []; adjust: []; ignore: [] }>();
const { t } = useI18n();
const recommendation = computed(() => props.record.recommendation);
const evidenceCount = computed(() => recommendation.value.evidence.length);
const effect = computed(() => {
  const change = recommendation.value.change;
  if (change.kind === 'bpm') return t('play.adaptation.effects.bpm', { from: change.from, to: change.to });
  if (change.kind === 'level') return t('play.adaptation.effects.level', {
    from: t(`catalog.levels.${change.from}`), to: t(`catalog.levels.${change.to}`),
  });
  return t('play.adaptation.effects.pattern');
});
</script>

<style scoped>
.recommendation-card { display: grid; gap: 16px; padding: 20px; border: 1px solid var(--fs-border); border-radius: 12px; background: var(--fs-raised); }
.recommendation-card__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.recommendation-card h3, .recommendation-card p { margin: 0; }
.recommendation-card dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
.recommendation-card dl > div { padding: 12px; border: 1px solid var(--fs-border); border-radius: 10px; background: var(--fs-surface); }
.recommendation-card dt { color: var(--fs-muted); font-size: .75rem; }
.recommendation-card dd { margin: 4px 0 0; overflow-wrap: anywhere; font-weight: 700; }
.recommendation-card__actions { display: flex; flex-wrap: wrap; gap: 10px; }
@media (max-width: 700px) { .recommendation-card dl { grid-template-columns: 1fr; } }
</style>
