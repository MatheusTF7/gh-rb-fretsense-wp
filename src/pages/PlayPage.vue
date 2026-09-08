<template>
  <PageFrame class="practice-page">
    <div ref="captureArea" class="practice-capture" tabindex="-1">
      <PageHeading :eyebrow="t('navigation.play')" :title="t('play.title')" :description="t('play.description')">
        <template #actions>
          <span class="status-tag">{{ t(snapshot ? `play.state.${state}` : 'play.state.setup') }}</span>
        </template>
      </PageHeading>

      <FeedbackBanner v-if="failure" class="q-mb-lg" tone="error" :message="t(`play.failure.${failure}`)">
        <template #actions>
          <q-btn v-if="failure === 'audio-unavailable'" flat no-caps :label="t('play.useSilent')" @click="useSilent" />
          <q-btn v-if="failure === 'device-unavailable' || failure === 'input-interrupted'" flat no-caps :to="{ name: 'devices' }" :label="t('play.configureDevice')" />
          <q-btn v-if="failure === 'calibration-mismatch'" flat no-caps :to="{ name: 'calibration' }" :label="t('play.openCalibration')" />
        </template>
      </FeedbackBanner>

      <template v-if="!snapshot">
        <section class="surface-card practice-setup" aria-labelledby="practice-setup-title">
          <div>
            <p class="eyebrow">{{ t('play.setupEyebrow') }}</p>
            <h2 id="practice-setup-title">{{ t('play.setupTitle') }}</h2>
            <p class="muted-text">{{ t('play.setupDescription') }}</p>
          </div>
          <div class="practice-fields">
            <q-select v-model="profileId" :options="profileOptions" emit-value map-options :label="t('play.profile')" :disable="starting" />
            <q-select v-if="profile.kind === 'gamepad'" v-model="connectionId" :options="connectionOptions" emit-value map-options :label="t('play.connection')" :disable="starting" />
            <q-select v-model="patternId" :options="patternOptions" emit-value map-options :label="t('play.pattern')" :disable="starting" />
            <q-select v-model="articulation" :options="articulationOptions" emit-value map-options :label="t('play.articulation')" :disable="starting || patternId === 'repeated-strum'" />
            <div class="practice-option">
              <q-toggle v-model="automaticStrum" color="primary" :label="t('play.automaticStrum')" :disable="starting" />
              <p class="muted-text">{{ t('play.automaticStrumHelp') }}</p>
            </div>
            <q-select v-model="chordSize" :options="chordOptions" emit-value map-options :label="t('play.chordSize')" :disable="starting || patternId === 'ascending-descending'" />
            <q-select v-model="sustainTicks" :options="sustainOptions" emit-value map-options :label="t('play.sustain')" :disable="starting" />
            <q-select
              v-if="patternId === 'repeated-strum' && chordSize === 1"
              v-model="alternateStrum"
              :options="alternateOptions"
              emit-value
              map-options
              :label="t('play.strumDirection')"
              :disable="starting"
            />
            <q-input v-model.number="bpm" type="number" min="40" max="300" step="1" :label="t('play.bpm')" :disable="starting" />
            <q-input v-model.number="repetitions" type="number" min="1" max="128" step="1" :label="t('play.repetitions')" :disable="starting" />
            <q-select v-model="audioMode" :options="audioOptions" emit-value map-options :label="t('play.audio')" :disable="starting" />
            <q-select v-model="calibrationId" :options="calibrationOptions" emit-value map-options :label="t('play.calibration')" :disable="starting" />
          </div>
          <div class="practice-context">
            <p>{{ t('play.deviceSummary', { device: profile.label }) }}</p>
            <p v-if="profile.kind === 'gamepad'" :class="{ 'text-negative': !matchingConnections.length }">
              {{ t(discoveryUnavailable ? 'play.gamepadApiUnavailable' : matchingConnections.length ? 'play.gamepadReady' : 'play.gamepadMissing') }}
            </p>
            <p>{{ t(calibrationId ? 'play.savedCalibration' : 'play.defaultCalibration') }}</p>
          </div>
          <div class="practice-actions">
            <q-btn unelevated color="primary" no-caps icon="play_arrow" :loading="starting" :label="t('play.start')" @click="startAttempt" />
            <q-btn v-if="profile.kind === 'gamepad'" outline no-caps icon="refresh" :label="t('play.refreshDevices')" :disable="starting" @click="refreshDevices" />
            <q-btn flat no-caps :to="{ name: 'devices' }" :label="t('play.configureDevice')" />
          </div>
        </section>
        <FretLegend />
        <p class="muted-text practice-caption">{{ t('play.keyboardHelp') }}</p>
      </template>

      <template v-else-if="!isFinished">
        <section class="gameplay-status" :aria-label="t('play.sessionStatus')">
          <div><span>{{ t('play.combo') }}</span><strong>{{ evaluation?.metrics.finalCombo ?? 0 }}</strong></div>
          <div><span>{{ t('play.notes') }}</span><strong>{{ resolvedNotes }}/{{ snapshot.chart.notes.length }}</strong></div>
          <div><span>{{ t('play.bpm') }}</span><strong>{{ snapshot.chart.bpm }}</strong></div>
          <div><span>{{ t('play.input') }}</span><strong>{{ view.inputCount }}</strong></div>
          <div v-if="evaluation?.pendingSustains"><span>{{ t('play.pendingSustains') }}</span><strong>{{ evaluation.pendingSustains }}</strong></div>
        </section>
        <q-linear-progress :value="progress" color="primary" track-color="grey-9" size="8px" rounded :aria-label="t('play.progress')" />
        <div class="highway-stage">
          <TrainingHighway :snapshot="snapshot" :active-time-ms="view.activeTimeMs" :active-frets="view.activeFrets" :judgments="judgments" :label="highwayLabel" />
          <div v-if="state === 'countdown'" class="countdown-overlay" aria-live="polite">
            <span>{{ countdownBeat }}</span><p>{{ t('play.countdown') }}</p>
          </div>
          <div v-if="isPaused" class="pause-overlay">
            <q-icon name="pause_circle" size="56px" aria-hidden="true" />
            <h2>{{ t('play.paused') }}</h2><p>{{ t('play.pausedDescription') }}</p>
          </div>
        </div>
        <p class="judgment-feedback" role="status" aria-live="polite">{{ feedbackText }}</p>
        <FretLegend />
        <div class="practice-actions practice-actions--centered">
          <q-btn v-if="isActive" unelevated color="primary" no-caps icon="pause" :label="t('play.pause')" @click="pause" />
          <q-btn v-if="isPaused" unelevated color="primary" no-caps icon="play_arrow" :loading="starting" :label="t('play.resume')" @click="resume" />
          <q-btn outline no-caps icon="restart_alt" :label="t('play.restart')" :loading="starting" @click="restart" />
          <q-btn flat no-caps icon="close" :label="t('play.exit')" @click="exitPractice" />
        </div>
      </template>

      <section v-else-if="result" class="surface-card result-card" aria-labelledby="practice-result-title">
        <p class="eyebrow">{{ t(`play.ending.${result.ending.state}`) }}</p>
        <h2 id="practice-result-title">{{ t(result.ending.state === 'completed' ? 'play.resultTitle' : 'play.abortedTitle') }}</h2>
        <p class="muted-text">{{ t(result.ending.state === 'completed' ? 'play.resultDescription' : 'play.abortedDescription') }}</p>
        <div class="result-metrics">
          <div><span>{{ t('play.accuracy') }}</span><strong>{{ ratioLabel(result.metrics.noteAccuracy) }}</strong></div>
          <div><span>{{ t('play.hits') }}</span><strong>{{ result.metrics.hitNotes }}/{{ result.metrics.plannedNotes }}</strong></div>
          <div><span>{{ t('play.bestCombo') }}</span><strong>{{ result.metrics.bestCombo }}</strong></div>
          <div><span>{{ t('play.meanTiming') }}</span><strong>{{ timingLabel }}</strong></div>
          <div><span>{{ t('play.articulationCompliance') }}</span><strong>{{ ratioLabel(result.metrics.articulationCompliance) }}</strong></div>
          <div><span>{{ t('play.extraStrums') }}</span><strong>{{ result.metrics.extraStrums }}</strong></div>
          <div v-if="snapshot.config.sustainTicks > 0"><span>{{ t('play.sustainCompletion') }}</span><strong>{{ ratioLabel(result.metrics.sustainCompletion) }}</strong></div>
          <div v-if="snapshot.config.sustainTicks > 0"><span>{{ t('play.brokenSustains') }}</span><strong>{{ result.metrics.brokenSustains }}</strong></div>
          <div v-if="snapshot.config.strumDirectionGoal.kind !== 'none'"><span>{{ t('play.directionCompliance') }}</span><strong>{{ ratioLabel(result.metrics.strumDirectionCompliance) }}</strong></div>
          <div><span>{{ t('play.duration') }}</span><strong>{{ durationLabel }}</strong></div>
        </div>
        <p v-if="result.interruptions.length" class="muted-text">{{ t('play.interruptions', { count: result.interruptions.length }) }}</p>
        <div class="practice-actions">
          <q-btn unelevated color="primary" no-caps icon="replay" :loading="starting" :label="t('play.repeat')" @click="repeat" />
          <q-btn outline no-caps icon="tune" :label="t('play.changeSetup')" @click="reset" />
          <q-btn flat no-caps icon="arrow_back" :label="t('common.backCatalog')" @click="exitPractice" />
        </div>
      </section>
    </div>
  </PageFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type { RatioMetric } from '@/engine/domain';
import { useTrainingSession } from '@/composables/useTrainingSession';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';
import FretLegend from '@/components/training/FretLegend.vue';
import TrainingHighway from '@/components/training/TrainingHighway.vue';

const { t } = useI18n();
const router = useRouter();
const training = useTrainingSession();
const {
  captureArea, profileId, profile, connectionId, matchingConnections, patternId, articulation, automaticStrum,
  chordSize, sustainTicks, alternateStrum, bpm, repetitions, audioMode, calibrationId, availableCalibrations,
  discoveryUnavailable, starting, failure, snapshot, view, evaluation, judgments,
  latestJudgment, result, state, isActive, isPaused, isFinished, countdownBeat,
  resolvedNotes, progress, refreshDevices, startAttempt, pause, resume, restart, repeat, leave, reset,
} = training;

const profileOptions = computed(() => training.ui.profiles.map((item) => ({ value: item.id, label: item.label })));
const connectionOptions = computed(() => matchingConnections.value.map((item) => ({ value: item.connectionId, label: `${item.index + 1} · ${item.hardwareId}` })));
const patternOptions = computed(() => [
  { value: 'ascending-descending', label: t('play.patternAscending') },
  { value: 'repeated-strum', label: t('play.patternRepeated') },
]);
const articulationOptions = computed(() => [
  { value: 'strum', label: t('play.strum') },
  ...(patternId.value === 'ascending-descending' ? [
    { value: 'hopo', label: t('play.hopo') },
    { value: 'tap', label: t('play.tap') },
  ] : []),
]);
const chordOptions = computed(() => [1, 2, 3].map((value) => ({ value, label: t('play.fretCount', { count: value }) })));
const sustainOptions = computed(() => [
  { value: 0, label: t('play.sustainNone') },
  { value: 120, label: t('play.sustainSixteenth') },
  { value: 240, label: t('play.sustainEighth') },
]);
const alternateOptions = computed(() => [
  { value: 'none', label: t('play.directionNone') },
  { value: 'down', label: t('play.directionDownFirst') },
  { value: 'up', label: t('play.directionUpFirst') },
]);
const audioOptions = computed(() => [
  { value: 'enabled', label: t('play.audioEnabled') },
  { value: 'silent', label: t('play.audioSilent') },
]);
const calibrationOptions = computed(() => [
  { value: null, label: t('play.calibrationDefault') },
  ...availableCalibrations.value.map((item) => ({ value: item.id, label: t('play.calibrationSaved', {
    input: signed(item.judgmentOffsetMs), visual: signed(item.visualOffsetMs),
  }) })),
]);
const highwayLabel = computed(() => t('play.highwayLabel', { current: resolvedNotes.value, total: snapshot.value?.chart.notes.length ?? 0 }));
const feedbackText = computed(() => {
  const event = latestJudgment.value;
  if (!event) return t('play.feedbackReady');
  if (event.kind === 'note-hit') {
    const techniqueFailure = event.technique.find((assessment) => assessment.outcome === 'failed');
    if (techniqueFailure?.reason === 'voluntary-strum-on-hopo') return t('play.feedbackTechnique.hopoStrum');
    if (techniqueFailure?.reason === 'strum-used-for-tap') return t('play.feedbackTechnique.tapStrum');
    if (techniqueFailure?.reason === 'wrong-strum-direction') return t('play.feedbackTechnique.direction');
    const error = event.timingErrorMs;
    if (Math.abs(error) <= 15) return t('play.feedbackExact');
    return t(error < 0 ? 'play.feedbackEarly' : 'play.feedbackLate', { ms: Math.round(Math.abs(error)) });
  }
  if (event.kind === 'extra-strum') return t('play.feedbackExtra');
  if (event.kind === 'note-miss') return t(event.cause === 'wrong-frets' ? 'play.feedbackFrets'
    : event.cause === 'missing-strum' ? 'play.feedbackStrum' : 'play.feedbackMiss');
  if (event.kind === 'sustain') return t(`play.feedbackSustain.${event.outcome}`);
  return t('play.feedbackReady');
});
const timingLabel = computed(() => {
  const timing = result.value?.metrics.timing;
  return timing?.status === 'available'
    ? `${signed(Math.round(timing.meanErrorMs))} ms` : t('play.unavailable');
});
const durationLabel = computed(() => `${((result.value?.activeDurationMs ?? 0) / 1000).toFixed(1)} s`);

function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function ratioLabel(metric: RatioMetric) { return metric.status === 'available' ? `${Math.round(metric.value * 100)}%` : t('play.unavailable'); }
async function useSilent() {
  audioMode.value = 'silent';
  await reset();
}
async function exitPractice() { await leave(); await router.push({ name: 'train' }); }
</script>

<style scoped>
.practice-capture:focus { outline: none; }
.practice-setup { display: grid; gap: 28px; }
.practice-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.practice-option { align-self: center; }
.practice-option p { margin: 0 0 0 40px; }
.practice-context { padding: 16px 18px; border-radius: 10px; background: var(--fs-raised); }
.practice-context p { margin: 0; }
.practice-context p + p { margin-top: 6px; }
.practice-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.practice-actions--centered { justify-content: center; margin-top: 22px; }
.gameplay-status { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 14px; }
.gameplay-status > div, .result-metrics > div { padding: 12px 14px; border: 1px solid var(--fs-border); border-radius: 10px; background: var(--fs-surface); }
.gameplay-status span, .result-metrics span { display: block; color: var(--fs-muted); font-size: 0.75rem; }
.gameplay-status strong, .result-metrics strong { display: block; margin-top: 2px; font-size: 1.15rem; }
.highway-stage { position: relative; margin-top: 14px; }
.countdown-overlay, .pause-overlay { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; padding: 24px; border-radius: 16px; color: white; background: rgb(7 12 19 / 72%); text-align: center; }
.countdown-overlay span { font-size: clamp(4rem, 14vw, 8rem); font-weight: 800; line-height: 1; }
.countdown-overlay p, .pause-overlay p { margin: 10px 0 0; }
.pause-overlay h2 { margin: 12px 0 0; color: white; }
.judgment-feedback { min-height: 32px; margin: 18px 0 0; color: var(--fs-accent); font-size: 1.1rem; font-weight: 700; text-align: center; }
.result-card { max-width: 860px; margin: 0 auto; }
.result-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 28px 0; }
.text-negative { color: var(--q-negative); }
@media (max-width: 700px) {
  .practice-fields, .result-metrics { grid-template-columns: 1fr; }
  .gameplay-status { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
</style>
