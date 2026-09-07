import type { Chart, Fret, FretMask, JudgmentEvent } from '@/engine/domain';
import { FRET_BITS } from '@/engine/domain/music';
import { ticksToMilliseconds, visualTime } from '@/engine/timing';

const FRETS: readonly Fret[] = ['G', 'R', 'Y', 'B', 'O'];
const COLORS: Readonly<Record<Fret, string>> = {
  G: '#67d18a', R: '#ef7070', Y: '#e6cf67', B: '#69aaf2', O: '#efa567',
};

interface ScheduledNote {
  readonly id: string;
  readonly timeMs: number;
  readonly frets: FretMask;
}

export interface HighwayFrame {
  readonly chart: Chart;
  readonly activeTimeMs: number;
  readonly visualOffsetMs: number;
  readonly activeFrets: FretMask;
  readonly judgments: readonly JudgmentEvent[];
  readonly pixelsPerSecond: number;
}

function lowerBound(notes: readonly ScheduledNote[], timeMs: number): number {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if ((notes[middle]?.timeMs ?? Number.POSITIVE_INFINITY) < timeMs) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Renderer sem estado musical: converte snapshots do motor em pixels. */
export class HighwayRenderer {
  private chart: Chart | null = null;
  private scheduled: readonly ScheduledNote[] = [];
  private judgments: readonly JudgmentEvent[] | null = null;
  private readonly resolved = new Map<string, 'hit' | 'miss'>();

  constructor(private readonly canvas: HTMLCanvasElement) {}

  draw(frame: HighwayFrame): void {
    this.prepareChart(frame.chart);
    this.prepareJudgments(frame.judgments);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    const density = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const pixelWidth = Math.round(width * density);
    const pixelHeight = Math.round(height * density);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    const context = this.canvas.getContext('2d');
    if (!context) return;
    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, width, height);

    const styles = getComputedStyle(this.canvas);
    const background = styles.getPropertyValue('--fs-highway').trim() || '#101620';
    const lane = styles.getPropertyValue('--fs-highway-lane').trim() || '#1a2230';
    const line = styles.getPropertyValue('--fs-border').trim() || '#344052';
    const hitLine = styles.getPropertyValue('--fs-highway-line').trim() || '#e7eef5';
    const text = styles.getPropertyValue('--fs-highway-text').trim() || '#f5f7fa';
    const muted = styles.getPropertyValue('--fs-highway-muted').trim() || '#b8c4cf';
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const padding = Math.min(Math.max(12, width * 0.035), width * 0.15);
    const laneWidth = (width - padding * 2) / FRETS.length;
    const hitY = height - Math.max(72, height * 0.18);
    for (let index = 0; index < FRETS.length; index += 1) {
      const x = padding + index * laneWidth;
      context.fillStyle = index % 2 === 0 ? lane : background;
      context.fillRect(x, 0, laneWidth, height);
      context.strokeStyle = line;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    context.beginPath();
    context.moveTo(width - padding, 0);
    context.lineTo(width - padding, height);
    context.stroke();

    const visualTimeMs = visualTime(frame.activeTimeMs, frame);
    const pixelsPerMs = frame.pixelsPerSecond / 1000;
    const pastMs = (height - hitY + 36) / pixelsPerMs;
    const futureMs = (hitY + 36) / pixelsPerMs;
    const first = lowerBound(this.scheduled, visualTimeMs - pastMs);
    for (let index = first; index < this.scheduled.length; index += 1) {
      const note = this.scheduled[index];
      if (!note || note.timeMs > visualTimeMs + futureMs) break;
      const y = hitY - (note.timeMs - visualTimeMs) * pixelsPerMs;
      const status = this.resolved.get(note.id);
      for (let laneIndex = 0; laneIndex < FRETS.length; laneIndex += 1) {
        const fret = FRETS[laneIndex];
        if (!fret || !(note.frets & FRET_BITS[fret])) continue;
        const x = padding + laneWidth * (laneIndex + 0.5);
        this.note(context, x, y, Math.min(18, laneWidth * 0.25), fret, status, text);
      }
    }

    context.strokeStyle = hitLine;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(padding, hitY);
    context.lineTo(width - padding, hitY);
    context.stroke();
    for (let index = 0; index < FRETS.length; index += 1) {
      const fret = FRETS[index];
      if (!fret) continue;
      const active = (frame.activeFrets & FRET_BITS[fret]) !== 0;
      const x = padding + laneWidth * (index + 0.5);
      const radius = Math.min(21, laneWidth * 0.29);
      context.beginPath();
      context.arc(x, hitY, radius, 0, Math.PI * 2);
      context.fillStyle = active ? COLORS[fret] : background;
      context.fill();
      context.strokeStyle = COLORS[fret];
      context.lineWidth = active ? 5 : 3;
      context.stroke();
      context.fillStyle = active ? '#15221a' : text;
      context.font = '700 12px Roboto, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(`${index + 1}/${fret}`, x, hitY);
    }
    context.fillStyle = muted;
    context.font = '500 11px Roboto, sans-serif';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillText(`${Math.round(frame.pixelsPerSecond)} px/s`, padding + 4, 8);
  }

  private prepareChart(chart: Chart): void {
    if (this.chart === chart) return;
    this.chart = chart;
    this.scheduled = chart.notes.map((note) => ({
      id: note.id, timeMs: ticksToMilliseconds(note.tick, chart.bpm), frets: note.frets,
    }));
    this.judgments = null;
    this.resolved.clear();
  }

  private prepareJudgments(judgments: readonly JudgmentEvent[]): void {
    if (this.judgments === judgments) return;
    this.judgments = judgments;
    this.resolved.clear();
    for (const event of judgments) {
      if (event.kind === 'note-hit') this.resolved.set(event.noteId, 'hit');
      else if (event.kind === 'note-miss') this.resolved.set(event.noteId, 'miss');
    }
  }

  private note(
    context: CanvasRenderingContext2D, x: number, y: number, radius: number,
    fret: Fret, status: 'hit' | 'miss' | undefined, text: string,
  ): void {
    context.save();
    context.globalAlpha = status ? 0.32 : 1;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = COLORS[fret];
    context.fill();
    context.strokeStyle = status === 'miss' ? '#ffffff' : '#15221a';
    context.lineWidth = status === 'miss' ? 4 : 2;
    context.stroke();
    context.fillStyle = status === 'miss' ? text : '#15221a';
    context.font = '700 12px Roboto, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(fret, x, y);
    context.restore();
  }
}
