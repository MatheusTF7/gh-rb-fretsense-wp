<template>
  <PageFrame class="practice-page">
    <div ref="captureArea" class="practice-capture" :class="{ 'practice-capture--focus': focusMode }" tabindex="-1">
      <PageHeading :eyebrow="t('navigation.play')" :title="t('play.title')" :description="t('play.description')">
        <template #actions>
          <span class="status-tag">{{ t(snapshot ? `play.state.${state}` : 'play.state.setup') }}</span>
        </template>
      </PageHeading>

      <FeedbackBanner v-if="failure" class="q-mb-lg" tone="error" :message="t(`play.failure.${failure}`)">
        <template #actions>
          <q-btn v-if="failure === 'audio-unavailable'" flat no-caps :label="t('play.useSilent')" @click="useSilent" />
          <q-btn v-if="failure === 'device-unavailable' || failure === 'device-incompatible' || failure === 'input-interrupted'"
            flat no-caps :to="{ name: 'devices' }" :label="t('play.configureDevice')" />
          <q-btn v-if="failure === 'calibration-mismatch'" flat no-caps :to="{ name: 'calibration' }" :label="t('play.openCalibration')" />
        </template>
      </FeedbackBanner>

      <PageState v-if="!snapshot && !selectedPreset" icon="library_music" :title="t('play.noConfigurationTitle')"
        :description="t('play.noConfigurationDescription')">
        <q-btn unelevated color="primary" no-caps :to="{ name: 'train' }" :label="t('common.browseCatalog')" />
      </PageState>

      <template v-else-if="!snapshot">
        <section class="surface-card practice-setup" aria-labelledby="practice-setup-title">
          <div>
            <p class="eyebrow">{{ t('play.setupEyebrow') }}</p>
            <h2 id="practice-setup-title">{{ t('play.setupTitle') }}</h2>
            <p class="muted-text">{{ t('play.setupDescription') }}</p>
          </div>

          <div class="practice-fields">
            <q-select v-model="mode" :options="modeOptions" emit-value map-options :label="t('play.mode.label')" :disable="starting" />
            <q-select v-model="technique" :options="techniqueOptions" emit-value map-options :label="t('play.technique')" :disable="starting" />
            <q-select v-model="level" :options="levelOptions" emit-value map-options :label="t('play.level')" :disable="starting" />
            <q-select :model-value="selectedPreset?.config.ruleProfile.id" :options="ruleOptions" emit-value map-options
              :label="t('play.ruleProfile')" disable />
          </div>

          <div v-if="selectedPreset" class="practice-objective">
            <strong>{{ t('catalog.objective') }}</strong>
            <span>{{ t(`techniques.${selectedPreset.technique}.objective`) }}</span>
          </div>

          <q-expansion-item default-opened icon="tune" :label="t('play.advancedTitle')" class="practice-advanced">
            <div class="practice-fields q-pt-md">
              <q-input v-model.number="bpm" type="number" :min="descriptor?.parameters.bpm.minimum"
                :max="descriptor?.parameters.bpm.maximum" step="1" :label="t('play.bpm')" :disable="starting" />
              <q-select v-model="subdivision" :options="subdivisionOptions" emit-value map-options
                :label="t('play.subdivision')" :disable="starting" />
              <q-select v-model="lengthKind" :options="lengthKindOptions" emit-value map-options
                :label="t('play.lengthKind')" :disable="starting" />
              <q-input v-model.number="lengthValue" type="number" min="1" step="1"
                :max="lengthKind === 'repetitions' ? 128 : 3000"
                :label="t(lengthKind === 'repetitions' ? 'play.repetitions' : 'play.durationBeats')" :disable="starting" />
              <q-select v-model="focusSegment" :options="focusOptions" emit-value map-options clearable
                :label="t('play.focusSegment')" :disable="starting || segmentOptions.length < 2" />
              <div class="practice-option">
                <q-toggle v-model="automaticStrum" color="primary" :label="t('play.automaticStrum')" :disable="starting" />
                <p class="muted-text">{{ t('play.automaticStrumHelp') }}</p>
              </div>
            </div>

            <fieldset class="practice-fieldset">
              <legend>{{ t('play.allowedFrets') }}</legend>
              <q-option-group v-model="allowedFrets" :options="fretOptions" type="checkbox" inline color="primary" :disable="starting" />
            </fieldset>

            <fieldset class="practice-fieldset">
              <legend>{{ t('play.goals.title') }}</legend>
              <div class="practice-fields">
                <q-input v-model.number="minimumAccuracy" type="number" min="0" max="100" step="1"
                  suffix="%" :label="t('play.goals.accuracy')" :disable="starting" />
                <q-input v-model.number="maximumErrors" type="number" min="0" max="131072" step="1"
                  :label="t('play.goals.errors')" :disable="starting" />
                <q-input v-model.number="consistentAttempts" type="number" min="1" max="128" step="1"
                  :label="t('play.goals.consistency')" :disable="starting" />
                <div class="goal-toggles">
                  <q-toggle v-model="requireArticulation" :label="t('play.goals.articulation')" :disable="starting" />
                  <q-toggle v-model="requireStrumDirection" :label="t('play.goals.direction')"
                    :disable="starting || !directionGoalAvailable" />
                  <q-toggle v-model="requireFullSustains" :label="t('play.goals.sustains')"
                    :disable="starting || !sustainGoalAvailable" />
                </div>
              </div>
            </fieldset>

            <fieldset class="practice-fieldset">
              <legend>{{ t('play.adaptation.modeTitle') }}</legend>
              <div class="practice-fields">
                <div class="practice-option">
                  <q-toggle v-model="adaptiveEnabled" color="primary"
                    :label="t('play.adaptation.modeEnabled')" :disable="starting" />
                  <p class="muted-text">{{ t('play.adaptation.modeHelp') }}</p>
                </div>
                <q-input v-model.number="adaptiveMaximumBlocks" type="number" min="1" max="12" step="1"
                  :label="t('play.adaptation.maximumBlocks')" :disable="starting || !adaptiveEnabled" />
              </div>
            </fieldset>

            <fieldset class="practice-fieldset visual-settings">
              <legend>{{ t('play.visual.title') }}</legend>
              <p class="muted-text">{{ t('play.visual.description') }}</p>
              <div class="practice-fields">
                <label>{{ t('play.visual.speed', { value: ui.highway.scrollSpeed }) }}
                  <q-slider v-model="ui.highway.scrollSpeed" :min="180" :max="600" :step="20" label color="primary" :disable="starting" />
                </label>
                <label>{{ t('play.visual.noteScale', { value: Math.round(ui.highway.noteScale * 100) }) }}
                  <q-slider v-model="ui.highway.noteScale" :min="0.8" :max="1.3" :step="0.05" label color="primary" :disable="starting" />
                </label>
                <label>{{ t('play.visual.perspective', { value: Math.round(ui.highway.perspectiveIntensity * 100) }) }}
                  <q-slider v-model="ui.highway.perspectiveIntensity" :min="0" :max="1" :step="0.05" label color="primary" :disable="starting" />
                </label>
                <label>{{ t('play.visual.gridContrast', { value: Math.round(ui.highway.gridContrast * 100) }) }}
                  <q-slider v-model="ui.highway.gridContrast" :min="0" :max="1" :step="0.05" label color="primary" :disable="starting" />
                </label>
                <q-select v-model="ui.highway.effects" :options="effectOptions" emit-value map-options
                  :label="t('play.visual.effects')" :disable="starting" />
                <q-toggle v-model="ui.highway.highContrast" :label="t('play.visual.highContrast')" color="primary" :disable="starting" />
              </div>
            </fieldset>
          </q-expansion-item>

          <div class="practice-fields">
            <q-select v-model="profileId" :options="profileOptions" emit-value map-options :label="t('play.profile')" :disable="starting" />
            <q-select v-if="profile.kind === 'gamepad'" v-model="connectionId" :options="connectionOptions"
              emit-value map-options :label="t('play.connection')" :disable="starting" />
            <q-select v-model="audioMode" :options="audioOptions" emit-value map-options :label="t('play.audio')" :disable="starting" />
            <q-select v-model="calibrationId" :options="calibrationOptions" emit-value map-options
              :label="t('play.calibration')" :disable="starting" />
          </div>

          <FeedbackBanner v-if="!preview.ok" tone="error"
            :message="t('play.preview.invalid', { path: preview.path, message: preview.message })" />

          <template v-else>
            <section class="attempt-summary" aria-labelledby="attempt-summary-title">
              <h3 id="attempt-summary-title">{{ t('play.summary.title') }}</h3>
              <dl>
                <div><dt>{{ t('play.mode.label') }}</dt><dd>{{ t(`play.mode.${mode}`) }}</dd></div>
                <div><dt>{{ t('play.notesPlanned') }}</dt><dd>{{ preview.chart.notes.length }}</dd></div>
                <div><dt>{{ t('play.bpm') }}</dt><dd>{{ preview.config.bpm }}</dd></div>
                <div><dt>{{ t('play.seed') }}</dt><dd>{{ preview.config.seed }}</dd></div>
                <div><dt>{{ t('play.visual.presentation') }}</dt><dd>{{ presentation.profile.displayName }}</dd></div>
              </dl>
              <p>{{ requirementText }}</p>
            </section>
            <ChartPreview :chart="preview.chart" />
            <section class="visual-preview" aria-labelledby="visual-preview-title">
              <h3 id="visual-preview-title">{{ t('play.visual.preview') }}</h3>
              <TrainingHighway :chart="preview.chart" :presentation="presentation" :active-time-ms="0"
                :visual-offset-ms="0" :active-frets="0" :judgments="emptyJudgments"
                :label="t('play.visual.previewLabel')" />
            </section>
            <FeedbackBanner :tone="compatibility.compatible ? 'info' : 'error'"
              :message="t(`play.compatibility.${compatibility.reason ?? 'compatible'}`)" />
          </template>

          <div class="practice-context">
            <p>{{ t('play.deviceSummary', { device: profile.label }) }}</p>
            <p v-if="profile.kind === 'gamepad'" :class="{ 'text-negative': !matchingConnections.length }">
              {{ t(discoveryUnavailable ? 'play.gamepadApiUnavailable' : matchingConnections.length ? 'play.gamepadReady' : 'play.gamepadMissing') }}
            </p>
            <p>{{ t(calibrationId ? 'play.savedCalibration' : 'play.defaultCalibration') }}</p>
          </div>
          <div class="practice-actions">
            <q-btn unelevated color="primary" no-caps icon="play_arrow" :loading="starting"
              :disable="!preview.ok || !compatibility.compatible" :label="t(`play.mode.start.${mode}`)" @click="startAttempt" />
            <q-btn v-if="profile.kind === 'gamepad'" outline no-caps icon="refresh" :label="t('play.refreshDevices')"
              :disable="starting" @click="refreshDevices" />
            <q-btn flat no-caps :to="{ name: 'devices' }" :label="t('play.configureDevice')" />
          </div>
        </section>
        <FretLegend />
        <p class="muted-text practice-caption">{{ t('play.keyboardHelp') }}</p>
      </template>

      <template v-else-if="!isFinished">
        <FeedbackBanner v-if="snapshot.mode === 'assessment'" class="q-mb-md" :message="t('play.assessmentFrozen')" />
        <section ref="gameplayArea" class="gameplay-frame" :class="{ 'gameplay-frame--focus': focusMode }">
          <header class="gameplay-toolbar">
            <span class="status-tag">{{ t(`play.state.${state}`) }}</span>
            <div>
              <q-btn flat dense no-caps :icon="focusMode ? 'fullscreen_exit' : 'center_focus_strong'"
                :label="t(focusMode ? 'play.focusExit' : 'play.focusEnter')" @click="toggleFocus" />
              <q-btn flat dense no-caps :icon="fullscreenActive ? 'fullscreen_exit' : 'fullscreen'"
                :label="t(fullscreenActive ? 'play.fullscreenExit' : 'play.fullscreenEnter')" @click="toggleFullscreen" />
            </div>
          </header>
          <p class="sr-status" role="status" aria-live="polite">{{ fullscreenMessage }}</p>
          <div class="gameplay-grid">
            <div class="highway-column">
              <q-linear-progress :value="progress" color="primary" track-color="grey-9" size="8px" rounded :aria-label="t('play.progress')" />
              <div class="highway-stage">
                <TrainingHighway :chart="snapshot.chart" :presentation="activePresentation" :active-time-ms="view.activeTimeMs"
                  :visual-offset-ms="snapshot.calibration.visualOffsetMs" :active-frets="view.activeFrets"
                  :judgments="judgments" :label="highwayLabel" />
                <div v-if="state === 'countdown'" class="countdown-overlay" aria-live="polite">
                  <span>{{ countdownBeat }}</span><p>{{ t('play.countdown') }}</p>
                </div>
                <div v-if="isPaused" class="pause-overlay" role="dialog" aria-modal="true" :aria-labelledby="'pause-title'">
                  <q-icon name="pause_circle" size="56px" aria-hidden="true" />
                  <h2 id="pause-title">{{ t('play.paused') }}</h2><p>{{ t('play.pausedDescription') }}</p>
                  <q-btn ref="resumeButton" unelevated color="primary" no-caps icon="play_arrow" :loading="starting"
                    :label="t('play.resume')" @click="resumeAttempt" />
                </div>
              </div>
              <p class="judgment-feedback" role="status" aria-live="polite">{{ feedbackText }}</p>
            </div>
            <aside class="gameplay-status" :aria-label="t('play.sessionStatus')">
              <div class="gameplay-status__primary"><span>{{ t('play.combo') }}</span><strong>{{ evaluation?.metrics.finalCombo ?? 0 }}</strong></div>
              <div><span>{{ t('play.notes') }}</span><strong>{{ resolvedNotes }}/{{ snapshot.chart.notes.length }}</strong></div>
              <div><span>{{ t('play.bpm') }}</span><strong>{{ snapshot.chart.bpm }}</strong></div>
              <div><span>{{ t('play.mode.label') }}</span><strong>{{ t(`play.mode.${snapshot.mode}`) }}</strong></div>
              <div><span>{{ t('play.attemptState') }}</span><strong>{{ t(`play.state.${state}`) }}</strong></div>
              <q-expansion-item dense icon="info" :label="t('play.secondaryStatus')">
                <div class="secondary-status">
                  <span>{{ t('play.input') }}: {{ view.inputCount }}</span>
                  <span v-if="evaluation?.pendingSustains">{{ t('play.pendingSustains') }}: {{ evaluation.pendingSustains }}</span>
                </div>
              </q-expansion-item>
            </aside>
          </div>
          <FretLegend />
          <div class="practice-actions practice-actions--centered">
            <q-btn v-if="isActive" unelevated color="primary" no-caps icon="pause" :label="t('play.pause')" @click="pause" />
            <q-btn outline no-caps icon="restart_alt"
              :label="armedAction === 'restart' ? t('play.confirmRestart') : t(snapshot.mode === 'assessment' ? 'play.restartAssessment' : 'play.restart')"
              :loading="starting" @click="requestAction('restart')" />
            <q-btn flat no-caps icon="close" :label="armedAction === 'exit' ? t('play.confirmExit') : t('play.exit')"
              @click="requestAction('exit')" />
          </div>
        </section>
      </template>

      <section v-else-if="result" class="surface-card result-card" aria-labelledby="practice-result-title">
        <p class="eyebrow">{{ t(`play.ending.${result.ending.state}`) }}</p>
        <h2 id="practice-result-title">{{ t(result.ending.state === 'completed' ? 'play.resultTitle' : 'play.abortedTitle') }}</h2>
        <p class="muted-text">{{ t(result.ending.state === 'completed' ? 'play.resultDescription' : 'play.abortedDescription') }}</p>
        <FeedbackBanner v-if="snapshot.mode === 'assessment' && !result.progression.eligible" class="q-mt-md"
          tone="error" :message="t('play.assessmentIneligible')" />
        <FeedbackBanner v-if="history.storageState.mode === 'memory'" class="q-mt-md" tone="error"
          :message="t(`history.storage.${history.storageState.issue ?? 'memory'}`)" />
        <FeedbackBanner v-else-if="adaptation.storageState.mode === 'memory'" class="q-mt-md" tone="error"
          :message="t(`history.storage.${adaptation.storageState.issue ?? 'memory'}`)" />
        <div class="result-metrics">
          <div><span>{{ t('play.accuracy') }}</span><strong>{{ ratioLabel(result.metrics.noteAccuracy) }}</strong></div>
          <div><span>{{ t('play.hits') }}</span><strong>{{ result.metrics.hitNotes }}/{{ result.metrics.plannedNotes }}</strong></div>
          <div><span>{{ t('play.bestCombo') }}</span><strong>{{ result.metrics.bestCombo }}</strong></div>
          <div><span>{{ t('play.meanTiming') }}</span><strong>{{ timingLabel }}</strong></div>
          <div><span>{{ t('play.articulationCompliance') }}</span><strong>{{ ratioLabel(result.metrics.articulationCompliance) }}</strong></div>
          <div><span>{{ t('play.extraStrums') }}</span><strong>{{ result.metrics.extraStrums }}</strong></div>
          <div v-if="hasSustains"><span>{{ t('play.sustainCompletion') }}</span><strong>{{ ratioLabel(result.metrics.sustainCompletion) }}</strong></div>
          <div v-if="hasSustains"><span>{{ t('play.brokenSustains') }}</span><strong>{{ result.metrics.brokenSustains }}</strong></div>
          <div v-if="snapshot.config.strumDirectionGoal.kind !== 'none'"><span>{{ t('play.directionCompliance') }}</span><strong>{{ ratioLabel(result.metrics.strumDirectionCompliance) }}</strong></div>
          <div><span>{{ t('play.duration') }}</span><strong>{{ durationLabel }}</strong></div>
        </div>
        <p v-if="result.interruptions.length" class="muted-text">{{ t('play.interruptions', { count: result.interruptions.length }) }}</p>
        <TrainingRecommendationCard v-if="adaptation.record && adaptation.record.sourceSessionId === result.sessionId"
          :record="adaptation.record" actionable :adaptive-limit-reached="adaptation.adaptiveLimitReached"
          @accept="applyRecommendation" @adjust="adjustRecommendation" @ignore="ignoreRecommendation" />
        <FeedbackBanner v-else-if="adaptation.loading" tone="info" :message="t('play.adaptation.evaluating')" />
        <FeedbackBanner v-else-if="adaptation.evaluationReason" tone="info"
          :message="t(`play.adaptation.unavailable.${adaptation.evaluationReason}`, {
            observed: adaptation.observedAttempts, required: adaptation.requiredAttempts,
          })" />
        <div class="practice-actions">
          <q-btn unelevated color="primary" no-caps icon="replay" :loading="starting" :label="t('play.repeatSame')" @click="repeat" />
          <q-btn outline no-caps icon="casino" :loading="starting" :disable="snapshot.config.manualPattern !== undefined"
            :label="t('play.generateVariation')" @click="vary" />
          <q-btn flat no-caps icon="receipt_long" :to="{ name: 'results', params: { id: result.sessionId } }" :label="t('play.viewResult')" />
          <q-btn flat no-caps icon="tune" :label="t('play.changeSetup')" @click="reset" />
        </div>
      </section>
    </div>
  </PageFrame>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type { Fret, JudgmentEvent, RatioMetric } from '@/engine/domain';
import { TECHNIQUE_DESCRIPTORS } from '@/catalog';
import { useTrainingSession } from '@/composables/useTrainingSession';
import PageFrame from '@/components/PageFrame.vue';
import PageHeading from '@/components/PageHeading.vue';
import PageState from '@/components/PageState.vue';
import FeedbackBanner from '@/components/FeedbackBanner.vue';
import ChartPreview from '@/components/training/ChartPreview.vue';
import FretLegend from '@/components/training/FretLegend.vue';
import TrainingHighway from '@/components/training/TrainingHighway.vue';
import TrainingRecommendationCard from '@/components/reports/TrainingRecommendationCard.vue';

const { t } = useI18n();
const router = useRouter();
const training = useTrainingSession();
const {
  ui, history, adaptation, captureArea, profileId, profile, connectionId, matchingConnections, selectedPreset,
  technique, level, descriptor, mode, bpm, subdivision, allowedFrets, lengthKind, lengthValue,
  automaticStrum, minimumAccuracy, maximumErrors, consistentAttempts, requireArticulation,
  requireStrumDirection, requireFullSustains, focusSegment, segmentOptions, audioMode, calibrationId,
  availableCalibrations, discoveryUnavailable, starting, failure, snapshot, view, evaluation, presentation,
  judgments, latestJudgment, result, preview, requirements, compatibility, state, isActive, isPaused,
  directionGoalAvailable, sustainGoalAvailable, isFinished, countdownBeat, resolvedNotes, progress,
  refreshDevices, startAttempt, pause, resume,
  restart, repeat, vary, applyRecommendation, adjustRecommendation, ignoreRecommendation, leave, reset,
} = training;
const gameplayArea = ref<HTMLElement | null>(null);
const resumeButton = ref<ComponentPublicInstance | null>(null);
const focusMode = ref(false);
const fullscreenActive = ref(false);
const fullscreenMessage = ref('');
const armedAction = ref<'restart' | 'exit' | null>(null);
const emptyJudgments: readonly JudgmentEvent[] = Object.freeze([]);
let armTimer: ReturnType<typeof setTimeout> | null = null;

const adaptiveEnabled = computed({
  get: () => adaptation.adaptiveEnabled,
  set: (value: boolean) => adaptation.configureAdaptive(value, adaptation.adaptiveMaximumBlocks),
});
const adaptiveMaximumBlocks = computed({
  get: () => adaptation.adaptiveMaximumBlocks,
  set: (value: number | string | null) => adaptation.configureAdaptive(adaptation.adaptiveEnabled, Number(value ?? 1)),
});

const techniqueOptions = computed(() => TECHNIQUE_DESCRIPTORS.map(({ id }) => ({ value: id, label: t(`techniques.${id}.title`) })));
const levelOptions = computed(() => ['beginner', 'intermediate', 'advanced'].map((value) => ({ value, label: t(`catalog.levels.${value}`) })));
const modeOptions = computed(() => ['practice', 'assessment'].map((value) => ({ value, label: t(`play.mode.${value}`) })));
const subdivisionOptions = computed(() => (descriptor.value?.parameters.subdivisions ?? []).map((value) => ({
  value, label: t('play.subdivisionValue', { value }),
})));
const fretOptions = computed(() => (['G', 'R', 'Y', 'B', 'O'] as Fret[]).map((value, index) => ({
  value, label: `${index + 1}/${value}`,
})));
const lengthKindOptions = computed(() => ['repetitions', 'duration'].map((value) => ({ value, label: t(`play.length.${value}`) })));
const focusOptions = computed(() => [
  { value: null, label: t('play.wholePattern') },
  ...segmentOptions.value.map((value) => ({ value, label: value })),
]);
const ruleOptions = [{ value: 'fretsense-v1', label: 'Fretsense v1' }];
const profileOptions = computed(() => training.ui.profiles.map((item) => ({ value: item.id, label: item.label })));
const connectionOptions = computed(() => matchingConnections.value.map((item) => ({ value: item.connectionId, label: `${item.index + 1} · ${item.hardwareId}` })));
const audioOptions = computed(() => [
  { value: 'enabled', label: t('play.audioEnabled') },
  { value: 'silent', label: t('play.audioSilent') },
]);
const effectOptions = computed(() => ['full', 'reduced', 'off'].map((value) => ({
  value, label: t(`play.visual.effectLevels.${value}`),
})));
const calibrationOptions = computed(() => [
  { value: null, label: t('play.calibrationDefault') },
  ...availableCalibrations.value.map((item) => ({ value: item.id, label: t('play.calibrationSaved', {
    input: signed(item.judgmentOffsetMs), visual: signed(item.visualOffsetMs),
  }) })),
]);
const highwayLabel = computed(() => t('play.highwayLabel', { current: resolvedNotes.value, total: snapshot.value?.chart.notes.length ?? 0 }));
const activePresentation = computed(() => snapshot.value?.presentation ?? presentation.value);
const hasSustains = computed(() => snapshot.value?.chart.notes.some((note) => note.durationTicks > 0) ?? false);
const requirementText = computed(() => requirements.value ? t('play.summary.requirements', {
  strum: t(requirements.value.needsStrum ? 'common.yes' : 'common.no'),
  direction: t(requirements.value.needsDirection ? 'common.yes' : 'common.no'),
  frets: requirements.value.maximumSimultaneousFrets,
  sustains: t(requirements.value.usesSustains ? 'common.yes' : 'common.no'),
}) : '');
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
  return timing?.status === 'available' ? `${signed(Math.round(timing.meanErrorMs))} ms` : t('play.unavailable');
});
const durationLabel = computed(() => `${((result.value?.activeDurationMs ?? 0) / 1000).toFixed(1)} s`);

function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function ratioLabel(metric: RatioMetric) { return metric.status === 'available' ? `${Math.round(metric.value * 100)}%` : t('play.unavailable'); }
async function useSilent() { audioMode.value = 'silent'; await reset(); }
async function exitPractice() { await leave(); await router.push({ name: 'train' }); }
async function resumeAttempt() {
  await resume();
  await nextTick();
  captureArea.value?.focus({ preventScroll: true });
}

function toggleFocus() {
  focusMode.value = !focusMode.value;
  ui.setTrainingFocus(focusMode.value);
}

function fullscreenChanged() {
  fullscreenActive.value = document.fullscreenElement === gameplayArea.value;
  fullscreenMessage.value = t(fullscreenActive.value ? 'play.fullscreenActive' : 'play.fullscreenInactive');
}

async function toggleFullscreen() {
  fullscreenMessage.value = '';
  try {
    if (document.fullscreenElement === gameplayArea.value) await document.exitFullscreen();
    else if (gameplayArea.value?.requestFullscreen) await gameplayArea.value.requestFullscreen();
    else fullscreenMessage.value = t('play.fullscreenUnavailable');
  } catch {
    fullscreenMessage.value = t('play.fullscreenUnavailable');
  }
}

async function requestAction(action: 'restart' | 'exit') {
  if (armedAction.value !== action) {
    armedAction.value = action;
    if (armTimer !== null) clearTimeout(armTimer);
    armTimer = setTimeout(() => { armedAction.value = null; armTimer = null; }, 5000);
    return;
  }
  armedAction.value = null;
  if (armTimer !== null) clearTimeout(armTimer);
  armTimer = null;
  if (action === 'restart') await restart();
  else await exitPractice();
}

watch(isPaused, async (paused) => {
  if (!paused) return;
  await nextTick();
  const element = resumeButton.value?.$el;
  if (element instanceof HTMLElement) element.focus();
});
watch(isFinished, (finished) => {
  if (!finished) return;
  focusMode.value = false;
  ui.setTrainingFocus(false);
});
onMounted(() => document.addEventListener('fullscreenchange', fullscreenChanged));
onBeforeUnmount(() => {
  if (armTimer !== null) clearTimeout(armTimer);
  document.removeEventListener('fullscreenchange', fullscreenChanged);
  if (document.fullscreenElement === gameplayArea.value) void document.exitFullscreen();
  ui.setTrainingFocus(false);
});
</script>

<style scoped>
.practice-capture:focus { outline: none; }
.practice-setup { display: grid; gap: 28px; }
.practice-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.practice-objective { display: flex; gap: 8px; padding: 16px 18px; border-radius: 10px; background: var(--fs-accent-soft); color: var(--fs-accent); }
.practice-advanced { border-block: 1px solid var(--fs-border); }
.practice-option { align-self: center; }
.practice-option p { margin: 0 0 0 40px; }
.practice-fieldset { min-width: 0; margin: 20px 0 0; padding: 16px; border: 1px solid var(--fs-border); border-radius: 10px; }
.practice-fieldset legend { padding: 0 8px; font-weight: 700; }
.visual-settings > p { margin-bottom: 18px; }
.visual-settings label { display: grid; gap: 8px; font-weight: 500; }
.goal-toggles { display: grid; align-content: center; }
.attempt-summary { padding: 18px; border: 1px solid var(--fs-border); border-radius: 12px; }
.attempt-summary h3 { margin-top: 0; }
.attempt-summary dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 0 0 12px; }
.attempt-summary dt { color: var(--fs-muted); font-size: .75rem; }
.attempt-summary dd { margin: 0; overflow-wrap: anywhere; font-weight: 700; }
.attempt-summary p { margin: 0; color: var(--fs-muted); }
.practice-context { padding: 16px 18px; border-radius: 10px; background: var(--fs-raised); }
.practice-context p { margin: 0; }
.practice-context p + p { margin-top: 6px; }
.practice-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.practice-actions--centered { justify-content: center; margin-top: 22px; }
.visual-preview { display: grid; gap: 12px; }
.visual-preview h3 { margin: 0; }
.visual-preview :deep(.training-highway) { height: 320px; }
.gameplay-frame {
  --fs-surface: #10151d;
  --fs-raised: #151c26;
  --fs-text: #f2f5f8;
  --fs-muted: #a7b1bf;
  --fs-border: #293342;
  --fs-accent: #b9a7ff;
  --fs-accent-soft: #292046;
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgb(145 160 184 / 20%);
  border-radius: 24px;
  color: var(--fs-text);
  background:
    radial-gradient(circle at 48% 0, rgb(108 78 214 / 13%), transparent 34%),
    linear-gradient(145deg, #0d1219, #080b11 72%);
  box-shadow: 0 22px 60px rgb(0 0 0 / 22%);
}
.gameplay-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 4px; }
.gameplay-toolbar > div { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
.gameplay-toolbar :deep(.q-btn) { color: var(--fs-muted); }
.gameplay-grid { display: grid; grid-template-columns: minmax(0, 1fr) 184px; align-items: stretch; gap: 18px; }
.highway-column { min-width: 0; }
.gameplay-status { display: grid; align-content: start; gap: 0; padding: 4px 0 4px 18px; border-left: 1px solid var(--fs-border); }
.gameplay-status > div { padding: 13px 10px; border-bottom: 1px solid rgb(167 177 191 / 12%); }
.result-metrics > div { padding: 12px 14px; border: 1px solid var(--fs-border); border-radius: 10px; background: var(--fs-surface); }
.gameplay-status span, .result-metrics span { display: block; color: var(--fs-muted); font-size: .75rem; }
.gameplay-status strong, .result-metrics strong { display: block; margin-top: 1px; font-size: 1.25rem; line-height: 1.25; }
.gameplay-status__primary strong { color: var(--fs-text); font-size: 2.35rem; letter-spacing: -.04em; }
.secondary-status { display: grid; gap: 6px; padding: 8px 12px 14px; }
.sr-status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.highway-stage { position: relative; margin-top: 10px; }
.countdown-overlay, .pause-overlay { position: absolute; z-index: 2; inset: 0; display: grid; place-content: center; justify-items: center; padding: 24px; border-radius: 16px; color: white; background: rgb(7 12 19 / 78%); text-align: center; }
.countdown-overlay span { font-size: clamp(4rem, 14vw, 8rem); font-weight: 800; line-height: 1; }
.countdown-overlay p, .pause-overlay p { margin: 10px 0 0; }
.pause-overlay h2 { margin: 12px 0 0; color: white; }
.pause-overlay .q-btn { margin-top: 22px; }
.judgment-feedback { min-height: 32px; margin: 10px 0 0; color: var(--fs-accent); font-size: 1.1rem; font-weight: 700; text-align: center; }
.gameplay-frame :deep(.fret-legend) { margin-top: 2px; }
.gameplay-frame :deep(.fret-legend > li) { background: rgb(255 255 255 / 4%); }
.practice-capture--focus :deep(.page-heading), .practice-capture--focus > .feedback-banner { display: none; }
.gameplay-frame--focus { max-width: 1440px; margin: 0 auto; }
.gameplay-frame:fullscreen { overflow: auto; padding: 18px; background: #080b11; }
.gameplay-frame:fullscreen .gameplay-grid { min-height: calc(100vh - 180px); }
.gameplay-frame:fullscreen :deep(.training-highway) { height: calc(100vh - 190px); }
.result-card { max-width: 900px; margin: 0 auto; }
.result-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 28px 0; }
.text-negative { color: var(--q-negative); }
@media (max-width: 800px) {
  .practice-fields, .result-metrics, .attempt-summary dl { grid-template-columns: 1fr; }
  .gameplay-grid { grid-template-columns: minmax(0, 1fr); }
  .gameplay-status { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 12px 0 0; border-top: 1px solid var(--fs-border); border-left: 0; }
  .gameplay-status .q-expansion-item { grid-column: 1 / -1; }
  .practice-objective { flex-direction: column; }
}
@media (max-width: 520px) {
  .gameplay-frame { padding: 12px; border-radius: 18px; }
  .gameplay-toolbar { align-items: stretch; flex-direction: column; }
  .gameplay-toolbar > div { justify-content: flex-start; }
  .gameplay-status { grid-template-columns: minmax(0, 1fr); }
  .gameplay-status .q-expansion-item { grid-column: auto; }
}
</style>
