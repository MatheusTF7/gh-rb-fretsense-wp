<template>
  <section class="surface-card manual-pattern-editor" aria-labelledby="manual-pattern-title">
    <div class="manual-pattern-header">
      <div>
        <h2 id="manual-pattern-title">{{ t('catalog.manual.title') }}</h2>
        <p>{{ t('catalog.manual.description') }}</p>
      </div>
      <q-btn
        outline
        no-caps
        icon="add"
        :label="t('catalog.manual.addStep')"
        :disable="rows.length >= ENGINE_LIMITS.maximumPatternLength"
        @click="addStep"
      />
    </div>

    <div class="manual-pattern-settings">
      <q-input v-model.number="lengthTicks" outlined type="number" min="1" :max="ENGINE_LIMITS.maximumTicks"
        :label="t('catalog.manual.lengthTicks')" />
      <q-input v-model.number="bpm" outlined type="number" :min="ENGINE_LIMITS.minimumBpm"
        :max="ENGINE_LIMITS.maximumBpm" :label="t('play.bpm')" />
    </div>

    <div class="manual-pattern-steps">
      <article v-for="(row, index) in rows" :key="row.clientId" class="manual-pattern-step">
        <strong>{{ t('catalog.manual.step', { number: index + 1 }) }}</strong>
        <q-input v-model.number="row.tick" outlined dense type="number" min="0" :label="t('catalog.manual.tick')" />
        <q-select v-model="row.frets" outlined dense multiple emit-value map-options :options="fretOptions"
          :label="t('catalog.manual.frets')" />
        <q-select v-model="row.articulation" outlined dense emit-value map-options :options="articulationOptions"
          :label="t('play.articulation')" />
        <q-input v-model.number="row.durationTicks" outlined dense type="number" min="0"
          :label="t('catalog.manual.durationTicks')" />
        <q-input v-model="row.segmentId" outlined dense maxlength="128" :label="t('catalog.manual.segment')" />
        <q-btn flat round icon="delete" :aria-label="t('catalog.manual.removeStep', { number: index + 1 })"
          :disable="rows.length === 1" @click="removeStep(index)" />
      </article>
    </div>

    <FeedbackBanner
      :tone="preview.ok ? 'info' : 'error'"
      :message="preview.ok
        ? t('catalog.manual.valid', { notes: preview.noteCount, version: preview.generatorVersion })
        : t('catalog.manual.invalid', { path: preview.path, message: preview.message })"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Articulation, Fret, NoteFrets } from '@/engine/domain';
import { countFrets, EngineError, ENGINE_LIMITS, FRET_BITS, MANUAL_PATTERN_REFERENCE, parseDrillConfig } from '@/engine/domain';
import { generateDrill } from '@/engine/generation';
import FeedbackBanner from '@/components/FeedbackBanner.vue';

interface EditableStep {
  readonly clientId: number;
  tick: number;
  frets: Fret[];
  articulation: Articulation;
  durationTicks: number;
  segmentId: string;
}

const { t } = useI18n();
const lengthTicks = ref(1920);
const bpm = ref(100);
let nextClientId = 3;
const rows = ref<EditableStep[]>([
  { clientId: 1, tick: 0, frets: ['G'], articulation: 'strum', durationTicks: 0, segmentId: 'intro' },
  { clientId: 2, tick: 480, frets: ['R'], articulation: 'hopo', durationTicks: 0, segmentId: 'intro' },
]);

const fretOptions = (Object.keys(FRET_BITS) as Fret[]).map((fret) => ({
  value: fret,
  label: `${fret} · ${t(`frets.${fret}`)}`,
}));
const articulationOptions = (['strum', 'hopo', 'tap'] as const).map((value) => ({ value, label: t(`play.${value}`) }));

function fretMask(frets: readonly Fret[]): NoteFrets {
  return frets.reduce((mask, fret) => mask | FRET_BITS[fret], 0) as NoteFrets;
}

function addStep(): void {
  const previous = rows.value.at(-1);
  rows.value.push({
    clientId: nextClientId,
    tick: previous ? previous.tick + 480 : 0,
    frets: ['G'],
    articulation: 'strum',
    durationTicks: 0,
    segmentId: previous?.segmentId ?? 'manual',
  });
  nextClientId += 1;
}

function removeStep(index: number): void {
  if (rows.value.length > 1) rows.value.splice(index, 1);
}

const preview = computed(() => {
  try {
    const steps = rows.value.map((row) => ({
      tick: row.tick,
      frets: fretMask(row.frets),
      durationTicks: row.durationTicks,
      articulation: row.articulation,
      segmentId: row.segmentId,
    }));
    const hasSustain = steps.some(({ durationTicks }) => durationTicks > 0);
    const usedFrets = steps.reduce((mask, step) => mask | step.frets, 0) as NoteFrets;
    const chordSize = Math.max(1, ...steps.map((step) => countFrets(step.frets))) as 1 | 2 | 3;
    const articulations = new Set(steps.map((step) => step.articulation));
    const articulation = articulations.size === 1 ? (steps[0]?.articulation ?? 'mixed') : 'mixed';
    const config = parseDrillConfig({
      schemaVersion: 1,
      technique: 'mixed',
      level: 'beginner',
      pattern: MANUAL_PATTERN_REFERENCE,
      manualPattern: { schemaVersion: 1, lengthTicks: lengthTicks.value, steps },
      bpm: bpm.value,
      subdivision: 4,
      allowedFrets: usedFrets,
      patternLength: steps.length,
      length: { kind: 'repetitions', count: 1 },
      articulation,
      automaticStrum: false,
      chordSize,
      sustainTicks: 0,
      strumDirectionGoal: { kind: 'none' },
      goals: {
        minimumAccuracy: 0.9,
        maximumErrors: 4,
        consistentAttempts: 3,
        requireArticulation: true,
        requireStrumDirection: false,
        requireFullSustains: hasSustain,
      },
      seed: 'fretsense-manual-preview',
      ruleProfile: { id: 'fretsense-v1', version: '1.0.0' },
    });
    const chart = generateDrill(config);
    return { ok: true as const, noteCount: chart.notes.length, generatorVersion: chart.generator.version };
  } catch (error) {
    return error instanceof EngineError
      ? { ok: false as const, path: error.path, message: error.message }
      : { ok: false as const, path: 'pattern', message: t('catalog.manual.unknownError') };
  }
});
</script>
