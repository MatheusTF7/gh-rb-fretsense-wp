import type {
  FretMask, InterruptionReason, JudgmentEvent, NormalizedInputEvent, ProgressionEligibility,
  SessionEnding, SessionInterruption, SessionResult, SessionSnapshot, SessionState,
} from '../domain';
import { ENGINE_LIMITS as limits } from '../domain/limits';
import { immutableCopy } from '../domain/immutable';
import { EngineError, readChoice, readInteger, readIsoDate, readNumber, readString, requireCondition } from '../domain/validation';
import { getChartEndTime, ticksToMilliseconds, type MonotonicClock } from '../timing/musical-time';
import { judgmentTime } from '../timing/calibrated-time';
import { InitialJudge } from '../judgment/initial-judge';
import { BoundedBuffer } from './bounded-buffer';
import { createUnjudgedMetrics, parseSessionEvaluation, type SessionEvaluation } from './evaluation';
import {
  createSessionSnapshot, repeatSessionSnapshot, varySessionSnapshot,
  type SessionIdentity, type SessionPreparation,
} from './snapshot';

export interface SessionServices {
  readonly clock: MonotonicClock;
  /** Deve produzir IDs inéditos; a sessão não usa aleatoriedade global nem data civil como ID. */
  nextIdentity(): SessionIdentity;
  utcNow(): string;
}

export interface SessionView {
  readonly state: SessionState;
  readonly sessionId: string | null;
  readonly activeTimeMs: number;
  readonly countdownRemainingMs: number;
  readonly inputCount: number;
  readonly result: SessionResult | null;
}

type AbortReason = Extract<SessionEnding, { state: 'aborted' }>['reason'];

/** Uma instância pertence a uma única tentativa e não agenda trabalho em segundo plano. */
export class TrainingSession {
  private state: SessionState = 'idle';
  private snapshot: SessionSnapshot | null = null;
  private result: SessionResult | null = null;
  private resultTaken = false;
  private readonly inputs = new BoundedBuffer<NormalizedInputEvent>(limits.maximumInputEvents);
  private readonly interruptions: SessionInterruption[] = [];
  private evaluation: SessionEvaluation | null = null;
  private judge: InitialJudge | null = null;
  private lastClockMs: number | null = null;
  private runningSinceMs: number | null = null;
  private countdownEndsAtMs: number | null = null;
  private accumulatedMs = 0;
  private activeTimeMs = 0;
  private countdownRemainingMs = 0;
  private endTimeMs = 0;
  private hardStopMs = 0;
  private activeFrets: FretMask = 0;
  private lastInputSequence = -1;
  private lastInputTimeMs = 0;
  private connectionId: string | null = null;
  private recordingStarted = false;
  private inputOverflow = false;

  constructor(private readonly services: SessionServices) {}

  getSnapshot(): SessionSnapshot | null { return this.snapshot; }
  getCountdownDeadline(): number | null { return this.countdownEndsAtMs; }

  getView(): SessionView {
    return Object.freeze({ state: this.state, sessionId: this.snapshot?.id ?? null,
      activeTimeMs: this.activeTimeMs, countdownRemainingMs: this.countdownRemainingMs,
      inputCount: this.inputs.size, result: this.result });
  }

  getInputs(): readonly NormalizedInputEvent[] { return this.inputs.snapshot(); }
  getJudgments(): readonly JudgmentEvent[] { return this.judge?.getEvents() ?? Object.freeze([]); }
  getEvaluation(): SessionEvaluation | null { return this.evaluation; }

  /** Ativação explícita antes da contagem; rejeita HOPO/caudas ainda não implementados. */
  enableInitialJudgment(): void {
    this.requireState('ready');
    if (this.judge) return;
    const judge = new InitialJudge(this.requireSnapshot());
    judge.setInputBaseline(this.activeFrets);
    this.judge = judge;
  }

  /** Projeta um instante da fonte monotônica sem avançar o horizonte de julgamento. */
  projectActiveTime(monotonicMs: number): number {
    readNumber(monotonicMs, 'clock.projection', 0, Number.MAX_SAFE_INTEGER);
    if (this.state !== 'running' || this.runningSinceMs === null) return this.activeTimeMs;
    requireCondition(monotonicMs >= this.runningSinceMs, 'clock.projection', 'Timestamp precedes the current running interval.', 'invalid-clock');
    return Math.min(this.hardStopMs, this.accumulatedMs + monotonicMs - this.runningSinceMs);
  }

  /** Canal de entrega única; getView continua permitindo consultar o mesmo resultado imutável. */
  takeResult(): SessionResult | null {
    if (this.result === null || this.resultTaken) return null;
    this.resultTaken = true;
    return this.result;
  }

  prepare(preparation: SessionPreparation): SessionSnapshot {
    this.requireState('idle');
    const snapshot = createSessionSnapshot(preparation, this.services.nextIdentity());
    this.installSnapshot(snapshot);
    return snapshot;
  }

  start(): SessionView {
    this.requireState('ready');
    this.beginCountdown();
    return this.getView();
  }

  /** Avança apenas quando chamado pelo coordenador, usando a fonte monotônica injetada. */
  advance(): SessionView {
    return this.advanceTime(true);
  }

  private advanceTime(allowCompletion: boolean): SessionView {
    if (this.state !== 'countdown' && this.state !== 'running') return this.getView();
    let now: number;
    try {
      now = this.readClock();
    } catch (error) {
      if (!(error instanceof EngineError) || error.code !== 'invalid-clock') throw error;
      this.enterPause('input-timing-invalid');
      return this.getView();
    }
    if (this.countdownEndsAtMs !== null) {
      this.countdownRemainingMs = Math.max(0, this.countdownEndsAtMs - now);
      if (now < this.countdownEndsAtMs) return this.getView();
      this.closeInterruption();
      this.runningSinceMs = this.countdownEndsAtMs;
      this.countdownEndsAtMs = null;
      this.state = 'running';
    }
    if (this.runningSinceMs !== null) {
      this.activeTimeMs = Math.min(this.hardStopMs, this.accumulatedMs + now - this.runningSinceMs);
      if (this.judge) {
        this.judge.advance(this.activeTimeMs);
        this.evaluation = this.judge.getEvaluation();
        if (allowCompletion && this.judge.complete) {
          this.complete();
          return this.getView();
        }
      }
      if (this.activeTimeMs >= this.hardStopMs) this.finish({ state: 'aborted', reason: 'evaluation-timeout' });
    }
    return this.getView();
  }

  pause(reason: InterruptionReason = 'user-pause'): SessionView {
    if (this.state === 'paused') return this.getView();
    this.requireState('countdown', 'running');
    readChoice(reason, ['user-pause', 'focus-lost', 'page-hidden', 'device-disconnected', 'audio-suspended', 'input-timing-invalid'], 'session.interruption');
    this.advanceTime(false);
    if (this.result === null) this.enterPause(reason);
    return this.getView();
  }

  resume(): SessionView {
    this.requireState('paused');
    this.beginCountdown();
    return this.getView();
  }

  /** Sincroniza frets mantidos sem fabricar transições de gameplay. */
  setInputBaseline(frets: FretMask): void {
    this.requireState('ready', 'countdown', 'paused');
    this.activeFrets = readInteger(frets, 'input.baseline', 0, 31) as FretMask;
    this.judge?.setInputBaseline(this.activeFrets);
    this.recordingStarted = true;
  }

  /** Entregar o lote capturado antes de advance(), conforme a convenção de horizonte. */
  recordInput(event: NormalizedInputEvent): void {
    this.requireState('running');
    const snapshot = this.requireSnapshot();
    let now: number;
    try {
      now = this.readClock();
    } catch (error) {
      if (error instanceof EngineError && error.code === 'invalid-clock') this.enterPause('input-timing-invalid');
      throw error;
    }
    const observedTime = this.accumulatedMs + now - (this.runningSinceMs ?? now);
    if (observedTime >= this.hardStopMs) {
      this.advance();
      return;
    }
    const sequence = readInteger(event.sequence, 'input.sequence', 0, Number.MAX_SAFE_INTEGER);
    requireCondition(this.lastInputSequence < 0 ? sequence === 0 : sequence > this.lastInputSequence,
      'input.sequence', 'Input sequence must increase from zero.');
    const sessionTimeMs = readNumber(event.sessionTimeMs, 'input.sessionTimeMs', Math.max(this.activeTimeMs, this.lastInputTimeMs), observedTime);
    const timeSource = readChoice(event.timeSource, ['device', 'observation'], 'input.timeSource');
    const active = readInteger(event.activeFrets, 'input.activeFrets', 0, 31);
    const pressedFrets = readInteger(event.pressedFrets, 'input.pressedFrets', 0, 31) as FretMask;
    const releasedFrets = readInteger(event.releasedFrets, 'input.releasedFrets', 0, 31) as FretMask;
    requireCondition(pressedFrets === (active & ~this.activeFrets & 31)
      && releasedFrets === (this.activeFrets & ~active & 31), 'input.frets', 'Fret transitions do not match the previous state.');
    const strum = event.strum === null ? null : readChoice(event.strum, ['up', 'down', 'unknown'], 'input.strum');
    if (strum !== null) {
      requireCondition(snapshot.device.capabilities.strum !== 'unavailable', 'input.strum', 'Device has no strum capability.');
      requireCondition(snapshot.device.capabilities.strum === 'directional' || strum === 'unknown', 'input.strum', 'Direction is not observable on this device.');
    }
    requireCondition(event.source.kind === snapshot.device.kind && event.source.deviceProfileId === snapshot.device.id,
      'input.source', 'Input belongs to another device.');
    const connectionId = readString(event.source.connectionId, 'input.source.connectionId');
    requireCondition(this.connectionId === null || this.connectionId === connectionId,
      'input.source.connectionId', 'Connection changes require an interruption.');
    const closesJudgment = this.judge !== null
      && judgmentTime(sessionTimeMs, snapshot.calibration) > this.endTimeMs;
    if (this.inputs.size === this.inputs.capacity && !closesJudgment) {
      this.inputOverflow = true;
      this.advanceTime(false);
      this.finish({ state: 'aborted', reason: 'resource-limit' });
      return;
    }
    // Copia apenas o contrato conhecido antes de entregá-lo aos dois consumidores.
    const acceptedEvent: NormalizedInputEvent = {
      sequence, sessionTimeMs, timeSource, activeFrets: active as FretMask, pressedFrets, releasedFrets, strum,
      source: { kind: snapshot.device.kind, deviceProfileId: snapshot.device.id, connectionId },
    };
    if (this.judge) {
      this.judge.processInput(acceptedEvent);
      this.evaluation = this.judge.getEvaluation();
      if (this.judge.complete) {
        // A ação está fora da tentativa: ela fecha o horizonte, mas não entra
        // no buffer nem altera a disponibilidade dos dados registrados.
        this.activeTimeMs = sessionTimeMs;
        this.complete();
        return;
      }
    }
    this.inputs.append(acceptedEvent);
    // Uma interrupção posterior nunca pode congelar antes de uma entrada aceita.
    this.activeTimeMs = sessionTimeMs;
    this.activeFrets = active as FretMask;
    this.connectionId = connectionId;
    this.lastInputSequence = sequence;
    this.lastInputTimeMs = sessionTimeMs;
    this.recordingStarted = true;
  }

  /** Porta para outro produtor quando o julgador inicial não foi ativado. */
  reportEvaluation(value: unknown): void {
    this.requireState('running', 'paused');
    requireCondition(this.judge === null, 'evaluation', 'The attached judge owns evaluation; external reports are disabled.', 'invalid-transition');
    const snapshot = this.requireSnapshot();
    const evaluation = parseSessionEvaluation(value, snapshot, judgmentTime(this.activeTimeMs, snapshot.calibration));
    requireCondition(evaluation.metrics.hitNotes + evaluation.metrics.extraStrums <= this.inputs.size,
      'evaluation.metrics', 'Hits and extra strums require recorded inputs.');
    if (this.evaluation !== null) {
      requireCondition(evaluation.throughTimeMs >= this.evaluation.throughTimeMs
        && evaluation.metrics.hitNotes >= this.evaluation.metrics.hitNotes
        && evaluation.metrics.missedNotes >= this.evaluation.metrics.missedNotes
        && evaluation.metrics.extraStrums >= this.evaluation.metrics.extraStrums
        && evaluation.metrics.brokenSustains >= this.evaluation.metrics.brokenSustains
        && evaluation.metrics.bestCombo >= this.evaluation.metrics.bestCombo
        && evaluation.judgmentCount >= this.evaluation.judgmentCount,
        'evaluation', 'An evaluation cannot undo previous judgments.');
    }
    this.evaluation = evaluation;
  }

  complete(evaluation?: unknown): SessionResult {
    if (this.result !== null) return this.result;
    this.requireState('running');
    if (evaluation !== undefined) this.reportEvaluation(evaluation);
    const snapshot = this.requireSnapshot();
    const report = this.evaluation;
    requireCondition(report !== null && report.metrics.unjudgedNotes === 0 && report.pendingSustains === 0
      && report.throughTimeMs > this.endTimeMs
      && report.throughTimeMs === judgmentTime(this.activeTimeMs, snapshot.calibration),
      'session.complete', 'Completion requires a current evaluation, all notes/tails resolved and the final inclusive window closed.');
    return this.finish({ state: 'completed' });
  }

  abort(reason: AbortReason = 'user-exit', evaluation?: unknown): SessionResult {
    if (this.result !== null) return this.result;
    this.requireState('ready', 'countdown', 'running', 'paused');
    readChoice(reason, ['user-exit', 'restart', 'context-changed', 'unrecoverable-error', 'resource-limit', 'evaluation-timeout'], 'session.abortReason');
    this.advanceTime(false);
    if (this.result !== null) return this.result;
    if (evaluation !== undefined) this.reportEvaluation(evaluation);
    return this.finish({ state: 'aborted', reason });
  }

  repeat(): TrainingSession {
    this.requireState('completed', 'aborted');
    return this.createNext();
  }

  vary(seed: string): TrainingSession {
    this.requireState('completed', 'aborted');
    return this.createNext(seed);
  }

  restart(evaluation?: unknown): TrainingSession {
    this.requireSnapshot();
    // Valida a próxima tentativa antes de encerrar a atual.
    const next = this.createNext();
    this.abort('restart', evaluation);
    return next;
  }

  private createNext(seed?: string): TrainingSession {
    const previous = this.requireSnapshot();
    const identity = this.services.nextIdentity();
    const snapshot = seed === undefined ? repeatSessionSnapshot(previous, identity)
      : varySessionSnapshot(previous, identity, seed);
    const next = new TrainingSession(this.services);
    next.installSnapshot(snapshot);
    if (this.judge) next.enableInitialJudgment();
    return next;
  }

  private installSnapshot(snapshot: SessionSnapshot): void {
    this.snapshot = snapshot;
    this.endTimeMs = getChartEndTime(snapshot.chart, snapshot.rules);
    this.hardStopMs = Math.max(0, this.endTimeMs + snapshot.calibration.judgmentOffsetMs) + limits.resultGraceMs;
    this.state = 'ready';
  }

  private beginCountdown(): void {
    const snapshot = this.requireSnapshot();
    const now = this.readClock();
    this.countdownRemainingMs = ticksToMilliseconds(snapshot.chart.ticksPerQuarter * limits.countdownBeats, snapshot.chart.bpm);
    this.countdownEndsAtMs = now + this.countdownRemainingMs;
    this.state = 'countdown';
  }

  private enterPause(reason: InterruptionReason): void {
    if (this.state === 'paused' || this.result !== null) return;
    // Outra pausa durante a contagem de retomada continua a mesma interrupção.
    const last = this.interruptions.at(-1);
    if (last === undefined || last.resumedAtIso !== null) {
      if (this.interruptions.length >= limits.maximumInterruptions) {
        this.finish({ state: 'aborted', reason: 'resource-limit' });
        return;
      }
      const startedAtIso = readIsoDate(this.services.utcNow(), 'session.interruption.startedAtIso');
      this.interruptions.push({ reason, sessionTimeMs: this.activeTimeMs, startedAtIso, resumedAtIso: null });
    }
    this.accumulatedMs = this.activeTimeMs;
    this.runningSinceMs = null;
    this.countdownEndsAtMs = null;
    this.countdownRemainingMs = 0;
    this.activeFrets = 0;
    this.connectionId = null;
    this.judge?.pause();
    this.state = 'paused';
  }

  private closeInterruption(): void {
    const last = this.interruptions.at(-1);
    if (last !== undefined && last.resumedAtIso === null) {
      this.interruptions[this.interruptions.length - 1] = {
        ...last, resumedAtIso: readIsoDate(this.services.utcNow(), 'session.interruption.resumedAtIso'),
      };
    }
  }

  private finish(ending: SessionEnding): SessionResult {
    if (this.result !== null) return this.result;
    const snapshot = this.requireSnapshot();
    const evaluation = this.evaluation;
    const metrics = evaluation?.metrics ?? createUnjudgedMetrics(snapshot.chart.notes.length);
    const judgmentRecords = evaluation?.judgmentRecords ?? 'not-recorded';
    const hasPendingEvaluation = evaluation !== null && (evaluation.pendingSustains > 0
      || evaluation.throughTimeMs < judgmentTime(this.activeTimeMs, snapshot.calibration));
    const reasons: Extract<ProgressionEligibility, { eligible: false }>['reasons'][number][] = [];
    if (ending.state === 'aborted') reasons.push('attempt-aborted');
    if (this.interruptions.length > 0) reasons.push('attempt-interrupted');
    const goals = snapshot.config.goals;
    if (evaluation === null || !this.recordingStarted || this.inputOverflow
      || !evaluation.requiredTechniqueDataComplete || metrics.noteAccuracy.status !== 'available'
      || (metrics.hitNotes > 0 && metrics.timing.status !== 'available')
      || (goals.requireArticulation && metrics.articulationCompliance.status !== 'available')
      || (goals.requireStrumDirection && (metrics.strumDirectionCompliance.status !== 'available' || snapshot.device.capabilities.strum !== 'directional'))
      || (goals.requireFullSustains && metrics.sustainCompletion.status !== 'available')) reasons.push('required-data-unavailable');
    const result: SessionResult = immutableCopy({
      schemaVersion: 1, sessionId: snapshot.id, ending,
      endedAtIso: readIsoDate(this.services.utcNow(), 'session.endedAtIso'),
      activeDurationMs: this.activeTimeMs, interruptions: this.interruptions, metrics, diagnostics: [],
      availability: {
        inputs: this.inputOverflow ? 'partial' : this.recordingStarted ? 'complete' : 'not-recorded',
        judgments: judgmentRecords === 'complete' && hasPendingEvaluation ? 'partial' : judgmentRecords,
        analysis: 'not-performed',
      },
      progression: reasons.length === 0 ? { eligible: true } : { eligible: false, reasons },
    });
    this.result = result;
    this.state = ending.state;
    this.runningSinceMs = null;
    this.countdownEndsAtMs = null;
    this.countdownRemainingMs = 0;
    this.activeFrets = 0;
    this.connectionId = null;
    return result;
  }

  private readClock(): number {
    const now = this.services.clock.nowMs();
    if (!Number.isFinite(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - 1_000_000
      || (this.lastClockMs !== null && now < this.lastClockMs)) {
      throw new EngineError('invalid-clock', 'clock.nowMs', 'Clock must be finite and monotonic.');
    }
    this.lastClockMs = now;
    return now;
  }

  private requireSnapshot(): SessionSnapshot {
    requireCondition(this.snapshot !== null, 'session.snapshot', 'Prepare an attempt first.', 'invalid-transition');
    return this.snapshot;
  }

  private requireState(...allowed: readonly SessionState[]): void {
    requireCondition(allowed.includes(this.state), 'session.state', `Action is unavailable in ${this.state}.`, 'invalid-transition');
  }
}
