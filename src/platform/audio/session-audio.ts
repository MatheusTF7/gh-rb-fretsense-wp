import type { TrainingSession } from '@/engine/session';
import { getChartEndTime } from '@/engine/timing';
import { ENGINE_LIMITS } from '@/engine/domain/limits';
import { Metronome } from './metronome';

/** O coordenador chama synchronize após início/avanço/pausa; áudio não avança a sessão. */
export class SessionAudio {
  readonly metronome: Metronome;
  private countdownDeadline: number | null = null;

  constructor(private readonly session: TrainingSession, private readonly onInterrupt: () => void) {
    this.metronome = new Metronome((reason) => {
      const state = session.getView().state;
      if (reason === 'context-changed' && state !== 'idle' && state !== 'completed' && state !== 'aborted') session.abort('context-changed');
      else if (state === 'running' || state === 'countdown') session.pause('audio-suspended');
      this.countdownDeadline = null;
      onInterrupt();
    });
  }

  synchronize(): void {
    const snapshot = this.session.getSnapshot();
    const view = this.session.getView();
    if (!snapshot || (view.state !== 'countdown' && view.state !== 'running')) {
      this.metronome.stop(); this.countdownDeadline = null; return;
    }
    const deadline = this.session.getCountdownDeadline();
    if (view.state !== 'countdown' || deadline === null || deadline === this.countdownDeadline) return;
    this.metronome.stop();
    if (snapshot.calibration.context.audioMode === 'enabled'
      && (snapshot.calibration.context.sampleRateHz !== this.metronome.sampleRateHz
        || snapshot.calibration.context.audioOutputId !== this.metronome.outputId)) {
      this.session.abort('context-changed');
      this.onInterrupt();
      return;
    }
    const step = 60_000 / snapshot.chart.bpm;
    const countdownBeats = ENGINE_LIMITS.countdownBeats;
    const origin = deadline - countdownBeats * step;
    // Pula somente cliques da contagem já vencidos; não toca uma rajada retroativa.
    const first = Math.max(0, Math.ceil((performance.now() + 50 - origin) / step));
    if (first >= countdownBeats) {
      this.countdownDeadline = null;
      this.session.pause('audio-suspended'); this.onInterrupt(); return;
    }
    const remaining = Math.max(0, getChartEndTime(snapshot.chart, snapshot.rules) - view.activeTimeMs);
    const musicalBeat = Math.ceil(view.activeTimeMs / step);
    const delayMs = Math.max(0, musicalBeat * step - view.activeTimeMs);
    const beats = Math.max(0, Math.ceil((remaining - delayMs) / step)) + countdownBeats - first;
    this.countdownDeadline = deadline;
    try {
      this.metronome.start({ bpm: snapshot.chart.bpm, beats, startAtMs: origin + first * step,
        beatOffset: first, silent: snapshot.calibration.context.audioMode === 'silent', onEnd() {},
        continuation: { afterBeats: countdownBeats - first, delayMs, beatOffset: musicalBeat },
      });
    } catch {
      this.metronome.stop(); this.countdownDeadline = null;
      this.session.pause('audio-suspended');
      this.onInterrupt();
    }
  }

  async dispose(): Promise<void> { await this.metronome.dispose(); }
}
