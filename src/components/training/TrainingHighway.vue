<template>
  <div class="highway-shell">
    <canvas
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
  label: string;
}>();

const quasar = useQuasar();
const canvas = ref<HTMLCanvasElement | null>(null);
let renderer: HighwayRenderer | null = null;
let resize: ResizeObserver | null = null;

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

watch(
  () => [
    props.chart,
    props.presentation,
    props.activeTimeMs,
    props.visualOffsetMs,
    props.activeFrets,
    props.judgments,
  ],
  draw,
  { flush: 'sync' },
);
watch(() => quasar.dark.isActive, () => { renderer?.invalidateStyles(); draw(); });
onMounted(() => {
  if (!canvas.value) return;
  renderer = new HighwayRenderer(canvas.value);
  resize = new ResizeObserver(([entry]) => {
    if (entry) resizeRenderer(entry.contentRect.width, entry.contentRect.height);
  });
  resize.observe(canvas.value);
  resizeRenderer(canvas.value.clientWidth, canvas.value.clientHeight);
});
onBeforeUnmount(() => {
  resize?.disconnect();
  resize = null;
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
.training-highway { display: block; width: 100%; height: clamp(360px, 62vh, 680px); }
@media (max-width: 599px) { .training-highway { height: min(58vh, 520px); min-height: 380px; } }
</style>
