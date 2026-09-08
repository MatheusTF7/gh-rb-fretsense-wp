import type {
  Articulation, Chart, Fret, FretMask, HighwayFeedbackKind, HighwayNoteShape, JudgmentEvent, StrumDirection,
} from '@/engine/domain';
import { FRET_BITS } from '@/engine/domain/music';
import { ticksToMilliseconds, visualTime } from '@/engine/timing';
import type {
  HighwayFrame, HighwayPresentationSnapshot, HighwayPreparation, HighwayRendererBackend,
  HighwayViewport, HighwayVisualEventUpdate,
} from './contracts';
import { HIGHWAY_FRET_ORDER } from './presentation-profile';

interface ScheduledNote {
  readonly id: string;
  readonly timeMs: number;
  readonly endTimeMs: number;
  readonly frets: FretMask;
  readonly articulation: Articulation;
  readonly expectedStrumDirection: StrumDirection | null;
}
interface ScheduledMarker { readonly timeMs: number; readonly kind: 'subdivision' | 'beat' | 'measure' }
type NoteStatus = 'hit' | 'miss';
type SustainStatus = Extract<JudgmentEvent, { kind: 'sustain' }>['outcome'];
type EffectKind = HighwayFeedbackKind;
interface VisualEffect { active: boolean; kind: EffectKind; noteId: string | null; startedAtMs: number; endsAtMs: number }
interface CachedStyles {
  background: string; lane: string; line: string; hitLine: string; text: string; muted: string; success: string; error: string;
}
const EMPTY_STYLES: CachedStyles = {
  background: '#101620', lane: '#1a2230', line: '#344052', hitLine: '#e7eef5',
  text: '#f5f7fa', muted: '#b8c4cf', success: '#67d18a', error: '#ff7085',
};
const NOTE_FONTS = Object.freeze([
  '700 9px Roboto, sans-serif', '700 10px Roboto, sans-serif', '700 11px Roboto, sans-serif',
  '700 12px Roboto, sans-serif', '700 13px Roboto, sans-serif',
]);
const FRET_INDEX: Readonly<Record<Fret, number>> = Object.freeze({ G: 0, R: 1, Y: 2, B: 3, O: 4 });

function lowerBound<T>(items: readonly T[], value: number, read: (item: T) => number): number {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    const item = items[middle];
    if (item !== undefined && read(item) < value) low = middle + 1;
    else high = middle;
  }
  return low;
}
const readNoteTime = (note: ScheduledNote) => note.timeMs;
const readMarkerTime = (marker: ScheduledMarker) => marker.timeMs;

/** Backend Canvas 2D sem estado musical: converte snapshots congelados em pixels. */
export class CanvasHighwayRenderer implements HighwayRendererBackend {
  readonly id = 'fretsense-canvas-2d';
  readonly capabilities = Object.freeze(['canvas-2d', 'perspective-projection', 'visual-effects'] as const);
  private context: CanvasRenderingContext2D | null;
  private backgroundCanvas: HTMLCanvasElement | null = null;
  private chart: Chart | null = null;
  private presentation: HighwayPresentationSnapshot | null = null;
  private scheduled: readonly ScheduledNote[] = [];
  private maximumSustainMs = 0;
  private markers: readonly ScheduledMarker[] = [];
  private readonly notesById = new Map<string, ScheduledNote>();
  private readonly resolved = new Map<string, NoteStatus>();
  private readonly sustains = new Map<string, SustainStatus>();
  private readonly brokenDash = [7, 7];
  private readonly notEvaluatedDash = [2, 6];
  private effects: VisualEffect[] = [];
  private judgmentCount = 0;
  private viewport: HighwayViewport = { width: 0, height: 0, pixelRatio: 1 };
  private styles: CachedStyles = EMPTY_STYLES;
  private stylesDirty = true;
  private backgroundDirty = true;
  private disposed = false;

  constructor(private readonly canvas: HTMLCanvasElement) { this.context = canvas.getContext('2d'); }

  prepare({ chart, presentation }: HighwayPreparation): void {
    if (this.disposed) return;
    const chartChanged = this.chart !== chart;
    const presentationChanged = this.presentation !== presentation;
    if (!chartChanged && !presentationChanged) return;
    this.chart = chart;
    this.presentation = presentation;
    if (chartChanged) {
      const scheduled = chart.notes.map((note) => ({
        id: note.id, timeMs: ticksToMilliseconds(note.tick, chart.bpm),
        endTimeMs: ticksToMilliseconds(note.tick + note.durationTicks, chart.bpm),
        frets: note.frets, articulation: note.articulation, expectedStrumDirection: note.expectedStrumDirection,
      }));
      this.scheduled = Object.freeze(scheduled);
      this.maximumSustainMs = scheduled.reduce((maximum, note) => Math.max(maximum, note.endTimeMs - note.timeMs), 0);
      this.notesById.clear();
      for (const note of scheduled) this.notesById.set(note.id, note);
      this.markers = this.buildMarkers(chart, presentation.profile.markers.subdivision);
      this.resolved.clear();
      this.sustains.clear();
      this.judgmentCount = 0;
      for (const effect of this.effects) effect.active = false;
    }
    if (presentationChanged) {
      this.brokenDash[0] = presentation.profile.sustains.brokenDash[0];
      this.brokenDash[1] = presentation.profile.sustains.brokenDash[1];
      this.effects = Array.from({ length: presentation.profile.feedback.maximumActiveEffects }, () => ({
        active: false, kind: 'hit' as const, noteId: null, startedAtMs: 0, endsAtMs: 0,
      }));
      this.stylesDirty = true;
      this.backgroundDirty = true;
    }
  }

  resize(viewport: HighwayViewport): void {
    if (this.disposed) return;
    const width = Math.max(0, Math.round(viewport.width));
    const height = Math.max(0, Math.round(viewport.height));
    const pixelRatio = Math.min(2.5, Math.max(1, viewport.pixelRatio));
    if (width === this.viewport.width && height === this.viewport.height && pixelRatio === this.viewport.pixelRatio) return;
    this.viewport = { width, height, pixelRatio };
    const pixelWidth = Math.round(width * pixelRatio);
    const pixelHeight = Math.round(height * pixelRatio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    this.backgroundDirty = true;
  }

  updateVisualEvents({ judgments, visualTimeMs }: HighwayVisualEventUpdate): void {
    if (this.disposed || !this.presentation) return;
    if (judgments.length < this.judgmentCount) {
      this.resolved.clear(); this.sustains.clear(); this.judgmentCount = 0;
      for (const effect of this.effects) effect.active = false;
    }
    for (let index = this.judgmentCount; index < judgments.length; index += 1) {
      const event = judgments[index];
      if (!event) continue;
      let effect: EffectKind | null = null;
      let noteId: string | null = 'noteId' in event ? event.noteId : null;
      if (event.kind === 'note-hit') {
        this.resolved.set(event.noteId, 'hit');
        effect = Math.abs(event.timingErrorMs) <= 15 ? 'hit' : event.timingErrorMs < 0 ? 'early' : 'late';
      } else if (event.kind === 'note-miss') {
        this.resolved.set(event.noteId, 'miss'); effect = 'miss';
      } else if (event.kind === 'extra-strum') {
        effect = 'extra'; noteId = null;
      } else {
        this.sustains.set(event.noteId, event.outcome);
        if (event.outcome === 'broken') effect = 'sustain-broken';
        else if (event.outcome === 'completed') effect = 'sustain-complete';
      }
      if (effect && this.presentation.preferences.effects !== 'off') this.activateEffect(effect, noteId, visualTimeMs);
    }
    this.judgmentCount = judgments.length;
  }

  invalidateStyles(): void { this.stylesDirty = true; this.backgroundDirty = true; }

  draw(frame: HighwayFrame): void {
    const context = this.context;
    const presentation = this.presentation;
    const { width, height, pixelRatio } = this.viewport;
    if (this.disposed || !context || !this.chart || !presentation || width === 0 || height === 0) return;
    if (this.stylesDirty) this.readStyles();
    if (this.backgroundDirty) this.renderBackground();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (this.backgroundCanvas) context.drawImage(this.backgroundCanvas, 0, 0, width, height);
    else { context.fillStyle = this.styles.background; context.fillRect(0, 0, width, height); }
    const timeMs = visualTime(frame.activeTimeMs, frame);
    this.drawMarkers(context, timeMs);
    this.drawNotes(context, timeMs);
    this.drawHitLineAndTargets(context, frame.activeFrets, timeMs);
    this.drawEffects(context, timeMs);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.chart = null; this.presentation = null; this.scheduled = []; this.maximumSustainMs = 0; this.markers = [];
    this.notesById.clear(); this.resolved.clear(); this.sustains.clear(); this.effects = [];
    this.backgroundCanvas = null; this.context = null; this.canvas.width = 0; this.canvas.height = 0;
  }

  private buildMarkers(chart: Chart, subdivision: 1 | 2 | 4): readonly ScheduledMarker[] {
    const step = chart.ticksPerQuarter / subdivision;
    const markers: ScheduledMarker[] = [];
    for (let tick = 0; tick <= chart.lengthTicks; tick += step) {
      markers.push({ timeMs: ticksToMilliseconds(tick, chart.bpm), kind: tick % (chart.ticksPerQuarter * 4) === 0
        ? 'measure' : tick % chart.ticksPerQuarter === 0 ? 'beat' : 'subdivision' });
    }
    return Object.freeze(markers);
  }

  private readStyles(): void {
    const styles = getComputedStyle(this.canvas);
    const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    this.styles = {
      background: token('--fs-highway', EMPTY_STYLES.background), lane: token('--fs-highway-lane', EMPTY_STYLES.lane),
      line: token('--fs-border', EMPTY_STYLES.line), hitLine: token('--fs-highway-line', EMPTY_STYLES.hitLine),
      text: token('--fs-highway-text', EMPTY_STYLES.text), muted: token('--fs-highway-muted', EMPTY_STYLES.muted),
      success: token('--fs-highway-success', EMPTY_STYLES.success), error: token('--fs-highway-error', EMPTY_STYLES.error),
    };
    this.stylesDirty = false;
  }

  private renderBackground(): void {
    const presentation = this.presentation;
    const { width, height, pixelRatio } = this.viewport;
    if (!presentation || width === 0 || height === 0) return;
    const buffer = this.backgroundCanvas ?? document.createElement('canvas');
    buffer.width = Math.round(width * pixelRatio); buffer.height = Math.round(height * pixelRatio);
    const context = buffer.getContext('2d');
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const stageGradient = context.createLinearGradient(0, 0, 0, height);
    stageGradient.addColorStop(0, '#070910');
    stageGradient.addColorStop(0.58, this.styles.background);
    stageGradient.addColorStop(1, '#05070b');
    context.fillStyle = stageGradient;
    context.fillRect(0, 0, width, height);

    const top = this.topY();
    const bottom = height;
    const horizonGlow = context.createRadialGradient(width * 0.5, top, 0, width * 0.5, top, width * 0.52);
    horizonGlow.addColorStop(0, 'rgba(116, 92, 255, 0.18)');
    horizonGlow.addColorStop(0.45, 'rgba(64, 90, 142, 0.07)');
    horizonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = horizonGlow;
    context.fillRect(0, 0, width, height * 0.58);

    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.82)';
    context.shadowBlur = 32;
    context.shadowOffsetY = 12;
    this.highwayPath(context, top, bottom);
    const roadGradient = context.createLinearGradient(0, top, 0, bottom);
    roadGradient.addColorStop(0, '#0c1119');
    roadGradient.addColorStop(0.42, this.styles.lane);
    roadGradient.addColorStop(1, '#0a0e14');
    context.fillStyle = roadGradient;
    context.fill();
    context.restore();

    for (let lane = 0; lane < HIGHWAY_FRET_ORDER.length; lane += 1) {
      const topLeft = this.highwayLeft(top) + this.laneWidth(top) * lane;
      const topRight = topLeft + this.laneWidth(top);
      const bottomLeft = this.highwayLeft(bottom) + this.laneWidth(bottom) * lane;
      const bottomRight = bottomLeft + this.laneWidth(bottom);
      context.beginPath();
      context.moveTo(topLeft, top);
      context.lineTo(topRight, top);
      context.lineTo(bottomRight, bottom);
      context.lineTo(bottomLeft, bottom);
      context.closePath();
      context.globalAlpha = lane % 2 === 0 ? 0.14 : 0.07;
      context.fillStyle = lane % 2 === 0 ? this.styles.hitLine : '#000000';
      context.fill();

      const fret = HIGHWAY_FRET_ORDER[lane];
      if (!fret) continue;
      context.save();
      context.globalAlpha = presentation.preferences.highContrast ? 0.36 : 0.18;
      context.strokeStyle = this.fretColor(fret);
      context.lineWidth = presentation.preferences.highContrast ? 2.5 : 1.5;
      context.shadowColor = this.fretColor(fret);
      context.shadowBlur = presentation.preferences.highContrast ? 11 : 7;
      context.beginPath();
      context.moveTo(this.laneCenter(top, lane), top);
      context.lineTo(this.laneCenter(bottom, lane), bottom);
      context.stroke();
      context.restore();
    }

    context.globalAlpha = presentation.preferences.highContrast ? 0.86 : 0.56;
    context.strokeStyle = this.styles.line;
    context.lineWidth = Math.max(presentation.preferences.highContrast ? 2 : 1,
      this.laneWidth(bottom) * presentation.profile.laneGapRatio);
    for (let lane = 0; lane <= HIGHWAY_FRET_ORDER.length; lane += 1) {
      context.beginPath();
      context.moveTo(this.highwayLeft(top) + this.highwayWidth(top) * lane / HIGHWAY_FRET_ORDER.length, top);
      context.lineTo(this.highwayLeft(bottom) + this.highwayWidth(bottom) * lane / HIGHWAY_FRET_ORDER.length, bottom);
      context.stroke();
    }
    context.globalAlpha = 0.7;
    context.strokeStyle = this.styles.hitLine;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(this.highwayLeft(top), top);
    context.lineTo(this.highwayLeft(top) + this.highwayWidth(top), top);
    context.stroke();
    context.globalAlpha = 1;
    this.backgroundCanvas = buffer;
    this.backgroundDirty = false;
  }

  private drawMarkers(context: CanvasRenderingContext2D, timeMs: number): void {
    const presentation = this.presentation;
    if (!presentation) return;
    const speed = presentation.preferences.scrollSpeed / 1000;
    const first = lowerBound(this.markers, timeMs - 900, readMarkerTime);
    context.save();
    for (let index = first; index < this.markers.length; index += 1) {
      const marker = this.markers[index]; if (!marker) continue;
      const y = this.hitY() - (marker.timeMs - timeMs) * speed;
      if (y < this.topY() - 8) break; if (y > this.viewport.height + 8) continue;
      context.globalAlpha = presentation.preferences.gridContrast * (marker.kind === 'measure' ? 0.95 : marker.kind === 'beat' ? 0.62 : 0.32);
      context.strokeStyle = marker.kind === 'measure' ? this.styles.hitLine : this.styles.line;
      context.lineWidth = marker.kind === 'measure' ? presentation.profile.markers.measureWidth
        : marker.kind === 'beat' ? presentation.profile.markers.beatWidth : 1;
      context.beginPath(); context.moveTo(this.highwayLeft(y), y);
      context.lineTo(this.highwayLeft(y) + this.highwayWidth(y), y); context.stroke();
    }
    context.restore();
  }

  private drawNotes(context: CanvasRenderingContext2D, timeMs: number): void {
    const presentation = this.presentation;
    if (!presentation) return;
    const pixelsPerMs = presentation.preferences.scrollSpeed / 1000;
    const pastLimit = timeMs - (this.viewport.height - this.hitY() + 80) / pixelsPerMs;
    const first = lowerBound(this.scheduled, pastLimit - this.maximumSustainMs, readNoteTime);
    const futureMs = (this.hitY() - this.topY() + 80) / pixelsPerMs;
    for (let index = first; index < this.scheduled.length; index += 1) {
      const note = this.scheduled[index]; if (!note || note.timeMs > timeMs + futureMs) break;
      if (note.endTimeMs < pastLimit) continue;
      const y = this.hitY() - (note.timeMs - timeMs) * pixelsPerMs;
      const endY = this.hitY() - (note.endTimeMs - timeMs) * pixelsPerMs;
      const status = this.resolved.get(note.id); const sustainStatus = this.sustains.get(note.id);
      let firstLane = -1; let lastLane = -1; let fretCount = 0;
      for (let laneIndex = 0; laneIndex < HIGHWAY_FRET_ORDER.length; laneIndex += 1) {
        const fret = HIGHWAY_FRET_ORDER[laneIndex];
        if (!fret || !(note.frets & FRET_BITS[fret])) continue;
        if (firstLane < 0) firstLane = laneIndex;
        lastLane = laneIndex; fretCount += 1;
      }
      if (fretCount > 1) this.chordConnector(context, y, firstLane, lastLane, status);
      for (let laneIndex = 0; laneIndex < HIGHWAY_FRET_ORDER.length; laneIndex += 1) {
        const fret = HIGHWAY_FRET_ORDER[laneIndex]; if (!fret || !(note.frets & FRET_BITS[fret])) continue;
        if (note.endTimeMs > note.timeMs) this.tail(context, laneIndex, y, endY, fret, status, sustainStatus);
        this.note(context, laneIndex, y, fret, note.articulation, note.expectedStrumDirection, status);
      }
    }
  }

  private drawHitLineAndTargets(context: CanvasRenderingContext2D, activeFrets: FretMask, timeMs: number): void {
    const presentation = this.presentation; if (!presentation) return;
    const y = this.hitY();
    const receptorY = this.receptorY();
    context.save();
    context.lineCap = 'round';
    context.strokeStyle = '#05070b';
    context.lineWidth = presentation.profile.hitLine.width + 7;
    context.beginPath(); context.moveTo(this.highwayLeft(y), y); context.lineTo(this.highwayLeft(y) + this.highwayWidth(y), y); context.stroke();
    context.shadowColor = this.styles.hitLine;
    context.shadowBlur = presentation.preferences.highContrast ? 14 : 8;
    context.strokeStyle = this.styles.hitLine; context.lineWidth = presentation.profile.hitLine.width;
    context.beginPath(); context.moveTo(this.highwayLeft(y), y); context.lineTo(this.highwayLeft(y) + this.highwayWidth(y), y); context.stroke();
    context.shadowBlur = 0;
    for (let index = 0; index < HIGHWAY_FRET_ORDER.length; index += 1) {
      const fret = HIGHWAY_FRET_ORDER[index]; if (!fret) continue;
      const active = (activeFrets & FRET_BITS[fret]) !== 0; const x = this.laneCenter(receptorY, index);
      const radius = Math.min(27, this.laneWidth(receptorY) * 0.31) * presentation.preferences.noteScale;
      const pulse = active && presentation.preferences.motion === 'full' && presentation.preferences.effects === 'full'
        ? 2 + Math.sin(timeMs / 45) : 0;
      context.shadowColor = this.fretColor(fret);
      context.shadowBlur = active ? 18 : 9;
      context.beginPath(); context.ellipse(x, receptorY, radius + 5 + pulse, (radius + pulse) * 0.7, 0, 0, Math.PI * 2);
      context.fillStyle = '#05070b'; context.fill();
      context.beginPath(); context.ellipse(x, receptorY, radius + pulse, (radius + pulse) * 0.62, 0, 0, Math.PI * 2);
      context.globalAlpha = active ? 0.9 : 0.28;
      context.fillStyle = this.fretColor(fret); context.fill();
      context.globalAlpha = 1;
      context.strokeStyle = this.fretColor(fret); context.lineWidth = active ? 5 : 3; context.stroke();
      context.shadowBlur = 0;
      context.beginPath(); context.ellipse(x, receptorY - radius * 0.12, radius * 0.6, radius * 0.28, 0, 0, Math.PI * 2);
      context.globalAlpha = active ? 0.32 : 0.12;
      context.fillStyle = '#ffffff'; context.fill();
      context.globalAlpha = 1;
    }
    context.restore();
  }

  private chordConnector(context: CanvasRenderingContext2D, y: number, first: number, last: number, status: NoteStatus | undefined): void {
    const presentation = this.presentation; if (!presentation) return;
    context.save(); context.globalAlpha = status ? 0.22 : 0.78; context.lineCap = 'round';
    context.strokeStyle = '#05070b';
    context.lineWidth = (presentation.profile.notes.chordConnectorWidth + 5) * this.depthScale(y);
    context.beginPath(); context.moveTo(this.laneCenter(y, first), y); context.lineTo(this.laneCenter(y, last), y); context.stroke();
    context.strokeStyle = this.styles.hitLine;
    context.lineWidth = presentation.profile.notes.chordConnectorWidth * this.depthScale(y);
    context.stroke(); context.restore();
  }

  private tail(context: CanvasRenderingContext2D, lane: number, headY: number, endY: number, fret: Fret,
    noteStatus: NoteStatus | undefined, sustainStatus: SustainStatus | undefined): void {
    const presentation = this.presentation; if (!presentation) return;
    const active = noteStatus === 'hit' && sustainStatus === undefined;
    context.save(); context.globalAlpha = noteStatus === 'miss' || sustainStatus === 'cancelled' ? 0.18
      : sustainStatus === 'not-evaluated' ? 0.42 : sustainStatus === 'completed' ? 0.34 : active ? 1 : 0.72;
    const color = sustainStatus === 'broken' ? this.styles.error
      : sustainStatus === 'not-evaluated' || sustainStatus === 'cancelled' ? this.styles.muted : this.fretColor(fret);
    const width = presentation.profile.sustains.width * presentation.preferences.noteScale
      * this.depthScale(headY) * (active ? 1.28 : 1);
    context.lineCap = sustainStatus === 'completed' ? 'butt' : 'round';
    if (sustainStatus === 'broken') context.setLineDash(this.brokenDash);
    else if (sustainStatus === 'not-evaluated') context.setLineDash(this.notEvaluatedDash);
    context.strokeStyle = '#05070b'; context.lineWidth = width + 6;
    context.beginPath(); context.moveTo(this.laneCenter(headY, lane), headY); context.lineTo(this.laneCenter(endY, lane), endY); context.stroke();
    context.strokeStyle = color; context.lineWidth = width;
    context.shadowColor = color; context.shadowBlur = active ? 10 : 4;
    context.beginPath(); context.moveTo(this.laneCenter(headY, lane), headY); context.lineTo(this.laneCenter(endY, lane), endY); context.stroke(); context.restore();
  }

  private note(context: CanvasRenderingContext2D, lane: number, y: number, fret: Fret, articulation: Articulation,
    direction: StrumDirection | null, status: NoteStatus | undefined): void {
    const presentation = this.presentation; if (!presentation) return;
    const x = this.laneCenter(y, lane); const radius = Math.min(presentation.profile.notes.baseRadius, this.laneWidth(y) * 0.27)
      * presentation.preferences.noteScale * this.depthScale(y);
    const shape = articulation === 'tap' ? presentation.profile.notes.tapShape
      : articulation === 'hopo' ? presentation.profile.notes.hopoShape : presentation.profile.notes.strumShape;
    context.save(); context.globalAlpha = status ? 0.26 : 1;
    context.shadowColor = status === 'miss' ? this.styles.error : this.fretColor(fret);
    context.shadowBlur = status ? 0 : presentation.preferences.highContrast ? 15 : 9;
    this.notePath(context, shape, x, y, radius);
    context.fillStyle = this.fretColor(fret); context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = status === 'miss' ? this.styles.error : '#05070b';
    context.lineWidth = status === 'miss' ? 4 : articulation === 'hopo' ? 3 : 3.5; context.stroke();
    this.notePath(context, shape, x, y, radius * 0.7);
    context.globalAlpha = status ? 0.18 : 0.26;
    context.strokeStyle = '#ffffff'; context.lineWidth = 1.5; context.stroke();
    context.beginPath();
    context.ellipse(x - radius * 0.2, y - radius * 0.2, radius * 0.27, radius * 0.1, -0.12, 0, Math.PI * 2);
    context.globalAlpha = status ? 0.12 : 0.62;
    context.fillStyle = '#ffffff'; context.fill();
    if (presentation.preferences.highContrast) {
      context.globalAlpha = status ? 0.3 : 1;
      context.fillStyle = status === 'miss' ? this.styles.text : '#05070b';
      const fontIndex = Math.round(Math.max(9, Math.min(13, radius * 0.7))) - 9;
      context.font = NOTE_FONTS[fontIndex] ?? NOTE_FONTS[0] ?? '700 9px Roboto, sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(fret, x, y);
    }
    if (direction) {
      context.globalAlpha = status ? 0.3 : 0.92;
      context.fillStyle = this.styles.text; context.font = '800 11px Roboto, sans-serif';
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(direction === 'down' ? '↓' : '↑', x, y - radius - 7);
    }
    context.restore();
  }

  private notePath(context: CanvasRenderingContext2D, shape: HighwayNoteShape, x: number, y: number, radius: number): void {
    context.beginPath();
    if (shape === 'square') context.roundRect(x - radius * 0.82, y - radius * 0.62, radius * 1.64, radius * 1.24, radius * 0.22);
    else if (shape === 'diamond') {
      context.moveTo(x, y - radius * 0.78);
      context.lineTo(x + radius, y);
      context.lineTo(x, y + radius * 0.78);
      context.lineTo(x - radius, y);
      context.closePath();
    } else context.ellipse(x, y, radius, radius * 0.6, 0, 0, Math.PI * 2);
  }

  private activateEffect(kind: EffectKind, noteId: string | null, timeMs: number): void {
    const presentation = this.presentation; if (!presentation || !this.effects.length) return;
    let slot = this.effects.find((effect) => !effect.active || effect.endsAtMs <= timeMs);
    if (!slot) {
      const priority = presentation.profile.feedback.priority;
      slot = this.effects.reduce((candidate, effect) => {
        const candidatePriority = priority.indexOf(candidate.kind);
        const effectPriority = priority.indexOf(effect.kind);
        return effectPriority < candidatePriority || (effectPriority === candidatePriority
          && effect.startedAtMs < candidate.startedAtMs) ? effect : candidate;
      });
      if (priority.indexOf(kind) < priority.indexOf(slot.kind)) return;
    }
    slot.active = true; slot.kind = kind; slot.noteId = noteId; slot.startedAtMs = timeMs;
    slot.endsAtMs = timeMs + presentation.profile.feedback.durationMs;
  }

  private drawEffects(context: CanvasRenderingContext2D, timeMs: number): void {
    const presentation = this.presentation; if (!presentation || presentation.preferences.effects === 'off') return;
    context.save();
    for (const effect of this.effects) {
      if (!effect.active) continue; if (effect.endsAtMs <= timeMs) { effect.active = false; continue; }
      const progress = Math.max(0, Math.min(1, (timeMs - effect.startedAtMs) / (effect.endsAtMs - effect.startedAtMs)));
      const note = effect.noteId ? this.notesById.get(effect.noteId) : undefined;
      const alpha = (1 - progress) * (presentation.preferences.effects === 'reduced' ? 0.55 : 0.9);
      const color = effect.kind === 'miss' || effect.kind === 'extra' || effect.kind === 'sustain-broken' ? this.styles.error : this.styles.success;
      for (let lane = 0; lane < HIGHWAY_FRET_ORDER.length; lane += 1) {
        const fret = HIGHWAY_FRET_ORDER[lane];
        if (note && (!fret || !(note.frets & FRET_BITS[fret]))) continue;
        if (!note && lane !== 2) continue;
        const x = this.laneCenter(this.hitY(), lane); const movement = presentation.preferences.motion === 'reduced' ? 0 : progress * 18;
        const y = this.hitY() + (effect.kind === 'early' ? -movement : effect.kind === 'late' ? movement : 0);
        context.globalAlpha = alpha; context.strokeStyle = color; context.lineWidth = presentation.preferences.highContrast ? 5 : 3;
        context.beginPath(); context.arc(x, y, 28 + (presentation.preferences.motion === 'full' ? progress * 18 : 0), 0, Math.PI * 2); context.stroke();
        if (effect.kind === 'early' || effect.kind === 'late' || effect.kind === 'extra') {
          context.fillStyle = color; context.font = '800 17px Roboto, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
          context.fillText(effect.kind === 'early' ? '▲' : effect.kind === 'late' ? '▼' : '×', x, y);
        }
      }
    }
    context.restore();
  }

  private fretColor(fret: Fret): string {
    const lane = this.presentation?.profile.lanes[FRET_INDEX[fret]];
    if (!lane) return this.styles.text;
    return this.presentation?.preferences.highContrast ? lane.highContrastColor : lane.color;
  }
  private highwayPath(context: CanvasRenderingContext2D, top: number, bottom: number): void {
    context.beginPath();
    context.moveTo(this.highwayLeft(top), top);
    context.lineTo(this.highwayLeft(top) + this.highwayWidth(top), top);
    context.lineTo(this.highwayLeft(bottom) + this.highwayWidth(bottom), bottom);
    context.lineTo(this.highwayLeft(bottom), bottom);
    context.closePath();
  }
  private topY(): number { return Math.max(10, this.viewport.height * (this.presentation?.profile.projection.safeMarginRatio ?? 0.035)); }
  private hitY(): number { return this.viewport.height * (this.presentation?.profile.hitLine.positionRatio ?? 0.82); }
  private receptorY(): number { return Math.min(this.viewport.height - 28, this.hitY() + Math.max(38, this.viewport.height * 0.07)); }
  private perspectiveAmount(): number {
    return this.presentation?.profile.projection.mode === 'perspective' ? this.presentation.preferences.perspectiveIntensity : 0;
  }
  private highwayWidth(y: number): number {
    const presentation = this.presentation; if (!presentation) return this.viewport.width;
    const top = this.topY(); const progress = Math.max(0, Math.min(1, (y - top) / Math.max(1, this.viewport.height - top)));
    const near = presentation.profile.projection.nearWidthRatio;
    const far = near + (presentation.profile.projection.farWidthRatio - near) * this.perspectiveAmount();
    return this.viewport.width * (far + (near - far) * progress);
  }
  private highwayLeft(y: number): number {
    const center = this.viewport.width * (this.presentation?.profile.projection.vanishingPointXRatio ?? 0.5);
    return center - this.highwayWidth(y) / 2;
  }
  private laneWidth(y: number): number { return this.highwayWidth(y) / HIGHWAY_FRET_ORDER.length; }
  private laneCenter(y: number, lane: number): number { return this.highwayLeft(y) + this.laneWidth(y) * (lane + 0.5); }
  private depthScale(y: number): number {
    const presentation = this.presentation; if (!presentation) return 1;
    const top = this.topY(); const progress = Math.max(0, Math.min(1, (y - top) / Math.max(1, this.hitY() - top)));
    const maximum = presentation.profile.notes.maximumScale;
    const far = maximum + (presentation.profile.notes.minimumScale - maximum) * this.perspectiveAmount();
    return far + (maximum - far) * progress;
  }
}

/** Nome mantido para integrações existentes; o contrato agora permite outros backends. */
export class HighwayRenderer extends CanvasHighwayRenderer {}
