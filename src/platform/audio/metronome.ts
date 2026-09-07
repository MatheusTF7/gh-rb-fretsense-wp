import { readInteger, readNumber } from '@/engine/domain/validation';

export interface AudioAnchor {
  readonly performanceMs: number;
  readonly audioSeconds: number;
}
export function toAudioSeconds(wallMs: number, anchor: AudioAnchor): number {
  return anchor.audioSeconds + (wallMs - anchor.performanceMs) / 1000;
}
export function fromAudioSeconds(seconds: number, anchor: AudioAnchor): number {
  return anchor.performanceMs + (seconds - anchor.audioSeconds) * 1000;
}
export interface MetronomeRun {
  readonly bpm: number;
  readonly beats: number;
  readonly startAtMs: number;
  readonly silent: boolean;
  readonly beatOffset?: number;
  /** Após a contagem, retoma a grade musical preservando a fração do beat pausado. */
  readonly continuation?: {
    readonly afterBeats: number;
    readonly delayMs: number;
    readonly beatOffset: number;
  };
  onEnd(): void;
}

/** Agenda apenas uma janela curta; atrasos não produzem rajadas de cliques. */
export class Metronome {
  private context: AudioContext | null = null;
  private anchor: AudioAnchor | null = null;
  private run: MetronomeRun | null = null;
  private nextBeat = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly nodes = new Map<OscillatorNode, GainNode>();
  private generation = 0;
  private disposed = false;

  constructor(
    private readonly onInterrupt: (
      reason: 'audio-suspended' | 'schedule-late' | 'context-changed',
    ) => void,
  ) {}
  get sampleRateHz(): number | null {
    return this.context?.sampleRate ?? null;
  }
  get outputId(): string | null {
    const context = this.context;
    if (!context || !('sinkId' in context)) return null;
    const sink = context.sinkId;
    return typeof sink === 'string' && sink.length > 0 && sink.length <= 256 ? sink : null;
  }

  /** Chamar diretamente a partir de um gesto; nenhuma tentativa automática de retomar. */
  async enable(): Promise<boolean> {
    if (this.disposed) return false;
    const generation = ++this.generation;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context?.removeEventListener('statechange', this.stateChange);
        this.context?.removeEventListener('sinkchange', this.sinkChange);
        this.context = new AudioContext({ latencyHint: 'interactive' });
        this.context.addEventListener('statechange', this.stateChange);
        this.context.addEventListener('sinkchange', this.sinkChange);
      }
      const context = this.context;
      await Promise.race([
        context.resume(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Audio activation timed out')), 3000);
        }),
      ]);
      if (this.disposed || generation !== this.generation || context.state !== 'running')
        return false;
      this.anchor = { audioSeconds: context.currentTime, performanceMs: performance.now() };
      return true;
    } catch {
      return false;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  start(run: MetronomeRun): void {
    this.stop();
    if (this.disposed) throw new Error('Disposed metronome');
    readNumber(run.bpm, 'metronome.bpm', 40, 300);
    readInteger(run.beats, 'metronome.beats', 1, 4096);
    readInteger(run.beatOffset ?? 0, 'metronome.beatOffset', 0, Number.MAX_SAFE_INTEGER);
    if (run.continuation) {
      readInteger(run.continuation.afterBeats, 'metronome.continuation.afterBeats', 0, run.beats);
      readNumber(run.continuation.delayMs, 'metronome.continuation.delayMs', 0, 60_000 / run.bpm);
      readInteger(
        run.continuation.beatOffset,
        'metronome.continuation.beatOffset',
        0,
        Number.MAX_SAFE_INTEGER,
      );
    }
    readNumber(
      (run.beats * 60_000) / run.bpm + (run.continuation?.delayMs ?? 0),
      'metronome.duration',
      1,
      610_000,
    );
    readNumber(run.startAtMs, 'metronome.start', performance.now() + 20, Number.MAX_SAFE_INTEGER);
    if (!run.silent) {
      if (this.context?.state !== 'running') throw new Error('Enable audio from a user gesture');
      this.anchor = { audioSeconds: this.context.currentTime, performanceMs: performance.now() };
    }
    this.run = run;
    this.nextBeat = 0;
    this.tick();
    if (this.run) this.timer = setInterval(this.tick, 25);
  }

  stop(): void {
    this.generation++;
    this.run = null;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    for (const [oscillator, gain] of this.nodes) {
      oscillator.onended = null;
      try {
        oscillator.stop();
      } catch {
        /* Já finalizado. */
      }
      oscillator.disconnect();
      gain.disconnect();
    }
    this.nodes.clear();
    this.anchor = null;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.stop();
    const context = this.context;
    this.context = null;
    if (context) {
      context.removeEventListener('statechange', this.stateChange);
      context.removeEventListener('sinkchange', this.sinkChange);
      try {
        await context.close();
      } catch {
        /* Recursos locais já foram desconectados. */
      }
    }
  }

  private readonly stateChange = () => {
    if (!this.disposed && this.context?.state !== 'running' && !this.run?.silent) {
      this.stop();
      this.onInterrupt('audio-suspended');
    }
  };
  private readonly sinkChange = () => {
    this.stop();
    this.onInterrupt('context-changed');
  };

  private readonly tick = () => {
    const run = this.run;
    if (!run) return;
    const now = performance.now();
    const step = 60_000 / run.bpm;
    if (!run.silent && this.context?.state !== 'running') {
      this.stop();
      this.onInterrupt('audio-suspended');
      return;
    }
    const timeAt = (beat: number) =>
      run.startAtMs +
      beat * step +
      (run.continuation && beat >= run.continuation.afterBeats ? run.continuation.delayMs : 0);
    while (this.nextBeat < run.beats && timeAt(this.nextBeat) <= now + 120) {
      const wall = timeAt(this.nextBeat);
      if (wall < now + 5) {
        this.stop();
        this.onInterrupt('schedule-late');
        return;
      }
      if (!run.silent) {
        const beat =
          run.continuation && this.nextBeat >= run.continuation.afterBeats
            ? this.nextBeat - run.continuation.afterBeats + run.continuation.beatOffset
            : this.nextBeat + (run.beatOffset ?? 0);
        try {
          this.click(wall, beat % 4 === 0);
        } catch {
          this.stop();
          this.onInterrupt('audio-suspended');
          return;
        }
      }
      this.nextBeat++;
    }
    if (now >= timeAt(run.beats)) {
      this.stop();
      run.onEnd();
    }
  };

  private click(wall: number, accent: boolean): void {
    const context = this.context;
    if (!context || !this.anchor || this.nodes.size >= 16) throw new Error('Audio unavailable');
    const when = toAudioSeconds(wall, this.anchor);
    if (when <= context.currentTime) throw new Error('Audio schedule is late');
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? 1000 : 700;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.12, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    oscillator.connect(gain);
    gain.connect(context.destination);
    this.nodes.set(oscillator, gain);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.nodes.delete(oscillator);
    };
    oscillator.start(when);
    oscillator.stop(when + 0.05);
  }
}
