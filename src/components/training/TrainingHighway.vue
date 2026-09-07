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
import { onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import type { FretMask, JudgmentEvent, SessionSnapshot } from '@/engine/domain';
import { HighwayRenderer } from '@/rendering';

const props = defineProps<{
  snapshot: SessionSnapshot;
  activeTimeMs: number;
  activeFrets: FretMask;
  judgments: readonly JudgmentEvent[];
  label: string;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let renderer: HighwayRenderer | null = null;
let resize: ResizeObserver | null = null;

function draw() {
  const frame = {
    chart: props.snapshot.chart,
    activeTimeMs: props.activeTimeMs,
    visualOffsetMs: props.snapshot.calibration.visualOffsetMs,
    activeFrets: props.activeFrets,
    judgments: props.judgments,
    pixelsPerSecond: 300,
  };
  renderer?.draw(frame);
}

watchEffect(draw);
onMounted(() => {
  if (!canvas.value) return;
  renderer = new HighwayRenderer(canvas.value);
  resize = new ResizeObserver(draw);
  resize.observe(canvas.value);
  draw();
});
onBeforeUnmount(() => resize?.disconnect());
</script>

<style scoped>
.highway-shell {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--fs-border);
  border-radius: 16px;
  background: var(--fs-highway, #101620);
}
.training-highway { display: block; width: 100%; height: clamp(360px, 62vh, 680px); }
@media (max-width: 599px) { .training-highway { height: 430px; } }
</style>
