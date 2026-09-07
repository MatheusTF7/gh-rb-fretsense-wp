import { readNumber, requireCondition } from '@/engine/domain/validation';

export const GUIDED = Object.freeze({ bpm: 90, countdown: 4, samples: 16, minimumSamples: 12, windowMs: 250, maximumMadMs: 40 });
export interface CalibrationEstimate { readonly offsetMs: number; readonly sampleCount: number; readonly rejected: number; readonly madMs: number }
function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Amostra limitada: uma palhetada por pulso, sem associar duas vezes a mesma referência. */
export class GuidedCalibration {
  private readonly errors = new Map<number, number>();
  private events = 0;
  private rejected = 0;
  constructor(readonly startAtMs: number) { readNumber(startAtMs, 'calibration.start', 0, Number.MAX_SAFE_INTEGER); }
  get sampleCount(): number { return this.errors.size; }
  get endAtMs(): number { return this.startAtMs + (GUIDED.countdown + GUIDED.samples) * 60_000 / GUIDED.bpm; }
  tap(wallMs: number): void {
    readNumber(wallMs, 'calibration.tap', 0, Number.MAX_SAFE_INTEGER);
    const step = 60_000 / GUIDED.bpm;
    const beat = Math.round((wallMs - this.startAtMs) / step);
    if (beat < GUIDED.countdown) return;
    requireCondition(++this.events <= 64, 'calibration.samples', 'Too many inputs.');
    const error = wallMs - (this.startAtMs + beat * step);
    if (beat >= GUIDED.countdown + GUIDED.samples || Math.abs(error) > GUIDED.windowMs || this.errors.has(beat)) { this.rejected++; return; }
    this.errors.set(beat, error);
  }
  estimate(): CalibrationEstimate {
    const values = [...this.errors.values()];
    requireCondition(values.length >= GUIDED.minimumSamples, 'calibration.samples', 'Insufficient samples.');
    const center = median(values);
    const madMs = median(values.map((value) => Math.abs(value - center)));
    const retained = values.filter((value) => Math.abs(value - center) <= Math.max(30, madMs * 3));
    requireCondition(retained.length >= GUIDED.minimumSamples && madMs <= GUIDED.maximumMadMs && this.rejected <= 4,
      'calibration.samples', 'Inconsistent calibration.');
    return Object.freeze({ offsetMs: Math.round(median(retained)), sampleCount: retained.length,
      rejected: this.rejected + values.length - retained.length, madMs: Math.round(madMs) });
  }
}
