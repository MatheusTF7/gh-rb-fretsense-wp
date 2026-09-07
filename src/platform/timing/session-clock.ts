import type { TrainingSession } from '@/engine/session';
import type { MonotonicClock } from '@/engine/timing';
import { EngineError, readNumber } from '@/engine/domain/validation';
import type { InputTimeline, InputTime } from '../input/contracts';

/** A mesma fonte deve ser injetada na TrainingSession e no coordenador. */
export class SessionClock implements MonotonicClock {
  private previous = 0;
  constructor(private readonly read: () => number = () => performance.now()) {}
  nowMs(): number {
    const now = this.read();
    if (!Number.isFinite(now) || now < this.previous || now > Number.MAX_SAFE_INTEGER) {
      throw new EngineError('invalid-clock', 'clock', 'Monotonic time is unavailable.');
    }
    this.previous = now;
    return now;
  }
}

/** Não pausa outro relógio: consulta as âncoras mantidas pela própria sessão. */
export class SessionInputTimeline implements InputTimeline {
  private previous = 0;
  constructor(private readonly session: TrainingSession, private readonly timeOriginMs = performance.timeOrigin) {}

  sample(observedAtMs: number, deviceTimestampMs?: number): InputTime {
    const result = normalizeInputTime(observedAtMs, deviceTimestampMs, this.timeOriginMs,
      (wall) => this.session.projectActiveTime(wall), Math.max(this.previous, this.session.getView().activeTimeMs));
    this.previous = result.sessionTimeMs;
    return result;
  }
}

/** Epoch legado só é aceito se puder ser convertido para a origem do performance clock. */
export function normalizeInputTime(
  observedAtMs: number, deviceTimestampMs: number | undefined, timeOriginMs: number,
  project: (wallMs: number) => number, horizonMs: number,
): InputTime {
  readNumber(observedAtMs, 'input.observation', 0, Number.MAX_SAFE_INTEGER);
  const observed = project(observedAtMs);
  if (!Number.isFinite(observed) || observed < horizonMs) throw new EngineError('invalid-clock', 'input.observation', 'Observation precedes the delivered horizon.');
  if (deviceTimestampMs !== undefined && Number.isFinite(deviceTimestampMs) && deviceTimestampMs > 0) {
    const wall = deviceTimestampMs > observedAtMs + 1000 ? deviceTimestampMs - timeOriginMs : deviceTimestampMs;
    if (wall >= 0 && wall <= observedAtMs && observedAtMs - wall <= 1000) {
      try {
        const candidate = project(wall);
        if (Number.isFinite(candidate) && candidate >= horizonMs && candidate <= observed) return { sessionTimeMs: candidate, timeSource: 'device' };
      } catch { /* Timestamp anterior à retomada: usar a observação, sem reabrir notas. */ }
    }
  }
  return { sessionTimeMs: observed, timeSource: 'observation' };
}
