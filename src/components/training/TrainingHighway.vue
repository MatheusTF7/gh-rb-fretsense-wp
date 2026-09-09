<template>
  <div class="highway-shell">
    <p v-if="!renderingAvailable" class="highway-unavailable" role="status">{{ unavailableLabel }}</p>
    <canvas
      v-show="renderingAvailable"
      ref="canvas"
      class="training-highway"
      role="img"
      :aria-label="label"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useQuasar } from 'quasar';
import type { Chart, FretMask, JudgmentEvent } from '@/engine/domain';
import { HighwayRenderer } from '@/rendering';
import type { HighwayPresentationSnapshot } from '@/rendering';

const props = defineProps<{
  chart: Chart;
  presentation: HighwayPresentationSnapshot;
  activeTimeMs: number;
  visualOffsetMs: number;
  activeFrets: FretMask;
  judgments: readonly JudgmentEvent[];
  judgmentCount: number;
  label: string;
  unavailableLabel: string;
}>();
const emit = defineEmits<{ availability: [available: boolean] }>();

const quasar = useQuasar();
const canvas = ref<HTMLCanvasElement | null>(null);
const renderingAvailable = ref(true);
let renderer: HighwayRenderer | null = null;
let resize: ResizeObserver | null = null;
let usingWindowResize = false;

function draw() {
  renderer?.prepare({ chart: props.chart, presentation: props.presentation });
  renderer?.updateVisualEvents({
    judgments: props.judgments,
    visualTimeMs: props.activeTimeMs - props.visualOffsetMs,
  });
  renderer?.draw({
    activeTimeMs: props.activeTimeMs,
    visualOffsetMs: props.visualOffsetMs,
    activeFrets: props.activeFrets,
  });
}

function resizeRenderer(width: number, height: number) {
  renderer?.resize({ width, height, pixelRatio: window.devicePixelRatio || 1 });
  draw();
}

function resizeFromCanvas() {
  const element = canvas.value;
  if (element) resizeRenderer(element.clientWidth, element.clientHeight);
}

watch(
  () => [
    props.chart,
    props.presentation,
    props.activeTimeMs,
    props.visualOffsetMs,
    props.activeFrets,
    props.judgments,
    props.judgmentCount,
  ],
  draw,
  { flush: 'sync' },
);
watch(() => quasar.dark.isActive, () => { renderer?.invalidateStyles(); draw(); });
onMounted(() => {
  if (!canvas.value) return;
  renderer = new HighwayRenderer(canvas.value);
  renderingAvailable.value = renderer.available;
  emit('availability', renderer.available);
  if (!renderer.available) return;
  if (typeof ResizeObserver === 'function') {
    resize = new ResizeObserver(([entry]) => {
      if (entry) resizeRenderer(entry.contentRect.width, entry.contentRect.height);
    });
    resize.observe(canvas.value);
  } else {
    usingWindowResize = true;
    window.addEventListener('resize', resizeFromCanvas);
  }
  resizeFromCanvas();
});
onBeforeUnmount(() => {
  resize?.disconnect();
  resize = null;
  if (usingWindowResize) window.removeEventListener('resize', resizeFromCanvas);
  usingWindowResize = false;
  renderer?.dispose();
  renderer = null;
});
</script>

<style scoped>
.highway-shell {
  position: relative;
  isolation: isolate;
  min-width: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--fs-border) 68%, white 12%);
  border-radius: 20px;
  background: #070a10;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 8%),
    inset 0 -20px 48px rgb(0 0 0 / 28%),
    0 18px 48px rgb(0 0 0 / 22%);
}
.highway-shell::after {
  position: absolute;
  inset: 0;
  z-index: 2;
  background:
    radial-gradient(circle at 50% 2%, rgb(125 97 255 / 13%), transparent 32%),
    linear-gradient(180deg, rgb(255 255 255 / 5%), transparent 18%, transparent 78%, rgb(0 0 0 / 24%));
  content: '';
  pointer-events: none;
}
.training-highway { display: block; width: 100%; height: clamp(400px, 68vh, 740px); }
.highway-unavailable { min-height: 400px; margin: 0; padding: 32px; color: var(--fs-highway-text); background: var(--fs-highway); }
@media (max-width: 599px) { .training-highway { height: min(64vh, 560px); min-height: 400px; } }
</style>
