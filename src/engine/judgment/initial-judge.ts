import type {
  ChartNote, ComboChange, FretMask, JudgmentEvent, NormalizedInputEvent, RatioMetric,
  SessionSnapshot, TechniqueAssessment,
} from '../domain';
import { ENGINE_LIMITS as limits } from '../domain/limits';
import { FRETSENSE_V1_RULE_PROFILE } from '../domain/rules';
import { immutableCopy } from '../domain/immutable';
import { readChoice, readInteger, readNumber, readString, requireCondition, requireSameData } from '../domain/validation';
import { BoundedBuffer } from '../session/bounded-buffer';
import type { SessionEvaluation } from '../session/evaluation';
import { createSessionSnapshot } from '../session/snapshot';
import { getChartEndTime, judgmentTime, ticksToMilliseconds } from '../timing';

interface ScheduledNote {
  readonly note: ChartNote;
  readonly timeMs: number;
  readonly deadlineMs: number;
  readonly endTimeMs: number;
}

interface ActiveSustain {
  readonly noteId: string;
  readonly frets: FretMask;
  readonly startedAtMs: number;
  readonly endTimeMs: number;
  readonly requiredDurationMs: number;
}

function ratio(numerator: number, denominator: number, reason: 'no-samples' | 'not-applicable' | 'unsupported-capability'): RatioMetric {
  return denominator > 0 ? { status: 'available', unit: 'ratio', numerator, denominator, value: numerator / denominator }
    : { status: 'unavailable', reason };
}

/** Julgador completo do perfil fretsense-v1, sem dependências de navegador ou tarefas assíncronas. */
export class InitialJudge {
  readonly snapshot: SessionSnapshot;
  private readonly notes: readonly ScheduledNote[];
  private readonly records = new BoundedBuffer<JudgmentEvent>(limits.maximumJudgmentEvents);
  private readonly activeSustains: ActiveSustain[] = [];
  private readonly endTimeMs: number;
  private readonly maximumRawMs: number;
  private readonly directionApplicable: boolean;
  private readonly sustainApplicable: boolean;
  private rawTimeMs = 0;
  private throughTimeMs = -limits.maximumOffsetMs;
  private cursor = 0;
  private previousHit = false;
  private hopoArmed = false;
  private releasedSinceHit = 0;
  private sawMissingStrum = false;
  private activeFrets: FretMask = 0;
  private connectionId: string | null = null;
  private lastSequence = -1;
  private inputCount = 0;
  private hitNotes = 0;
  private missedNotes = 0;
  private extraStrums = 0;
  private combo = 0;
  private bestCombo = 0;
  private meanErrorMs = 0;
  private meanAbsoluteErrorMs = 0;
  private squaredDeviation = 0;
  private articulationPassed = 0;
  private directionPassed = 0;
  private directionSamples = 0;
  private directionUnavailable: boolean;
  private completedSustains = 0;
  private brokenSustains = 0;
  private sustainUnavailable = false;
  private suspended = false;

  constructor(snapshot: SessionSnapshot) {
    readChoice(snapshot.schemaVersion, [1], 'snapshot.schemaVersion');
    requireSameData(snapshot.rules, FRETSENSE_V1_RULE_PROFILE, 'snapshot.rules');
    this.snapshot = createSessionSnapshot(snapshot, { id: snapshot.id, createdAtIso: snapshot.createdAtIso }, snapshot.chart);
    this.notes = this.snapshot.chart.notes.map((note) => {
      const timeMs = ticksToMilliseconds(note.tick, this.snapshot.chart.bpm);
      return {
        note,
        timeMs,
        deadlineMs: timeMs + this.snapshot.rules.hitWindow.lateMs,
        endTimeMs: ticksToMilliseconds(note.tick + note.durationTicks, this.snapshot.chart.bpm),
      };
    });
    this.endTimeMs = getChartEndTime(this.snapshot.chart, this.snapshot.rules);
    this.directionApplicable = this.notes.some(({ note }) => note.expectedStrumDirection !== null);
    this.sustainApplicable = this.notes.some(({ note }) => note.durationTicks > 0);
    this.directionUnavailable = this.directionApplicable && this.snapshot.device.capabilities.strum !== 'directional';
    this.maximumRawMs = Math.max(0, this.endTimeMs + this.snapshot.calibration.judgmentOffsetMs) + limits.resultGraceMs;
  }

  get complete(): boolean {
    return this.cursor === this.notes.length && this.activeSustains.length === 0 && this.throughTimeMs > this.endTimeMs;
  }

  getEvents(): readonly JudgmentEvent[] { return this.records.snapshot(); }

  /** Preparação/contagem: sincroniza estado sem fabricar ataques ou liberações. */
  setInputBaseline(frets: FretMask): void {
    this.activeFrets = readInteger(frets, 'judge.baseline', 0, 31) as FretMask;
  }

  /** Congela a observação, preserva caudas ativas e desarma a cadeia HOPO. */
  pause(): void {
    this.activeFrets = 0;
    this.connectionId = null;
    this.hopoArmed = false;
    this.releasedSinceHit = 0;
    this.suspended = this.activeSustains.length > 0;
  }

  /** Confere o baseline restaurado no mesmo instante musical em que a pausa ocorreu. */
  resume(): void {
    if (!this.suspended) return;
    this.suspended = false;
    this.breakMismatchedSustains(this.throughTimeMs, null);
  }

  /** Abandono cancela caudas observáveis sem convertê-las em falha. */
  abort(): void {
    for (const sustain of this.activeSustains.splice(0)) {
      this.records.append({
        sequence: this.records.size,
        timeMs: this.throughTimeMs,
        combo: this.preserveCombo(),
        kind: 'sustain',
        noteId: sustain.noteId,
        inputSequence: null,
        outcome: 'cancelled',
        heldDurationMs: this.heldDuration(sustain, this.throughTimeMs),
        requiredDurationMs: sustain.requiredDurationMs,
        technique: { objective: 'sustain', outcome: 'not-evaluated', reason: 'attempt-aborted' },
      });
      this.sustainUnavailable = true;
    }
    this.suspended = false;
  }

  advance(rawTimeMs: number): void {
    readNumber(rawTimeMs, 'judge.clock', this.rawTimeMs, this.maximumRawMs);
    if (this.complete) return;
    this.advanceMusicalTime(judgmentTime(rawTimeMs, this.snapshot.calibration));
    this.rawTimeMs = rawTimeMs;
  }

  processInput(event: NormalizedInputEvent): void {
    // Valida toda a entrada antes de alterar prazos, combo ou registros.
    readNumber(event.sessionTimeMs, 'judge.input.time', this.rawTimeMs, this.maximumRawMs);
    requireCondition(!this.complete, 'judge.state', 'The judgment is already complete.', 'invalid-transition');
    readInteger(event.sequence, 'judge.input.sequence', 0, Number.MAX_SAFE_INTEGER);
    requireCondition(this.lastSequence < 0 ? event.sequence === 0 : event.sequence > this.lastSequence,
      'judge.input.sequence', 'Input sequence must increase from zero.');
    readChoice(event.timeSource, ['device', 'observation'], 'judge.input.timeSource');
    readInteger(event.activeFrets, 'judge.input.active', 0, 31);
    readInteger(event.pressedFrets, 'judge.input.pressed', 0, 31);
    readInteger(event.releasedFrets, 'judge.input.released', 0, 31);
    requireCondition(event.pressedFrets === (event.activeFrets & ~this.activeFrets & 31)
      && event.releasedFrets === (this.activeFrets & ~event.activeFrets & 31), 'judge.input.frets', 'Invalid fret transitions.');
    if (event.strum !== null) {
      readChoice(event.strum, ['up', 'down', 'unknown'], 'judge.input.strum');
      requireCondition(this.snapshot.device.capabilities.strum !== 'unavailable'
        && (this.snapshot.device.capabilities.strum === 'directional' || event.strum === 'unknown'), 'judge.input.strum', 'Unsupported strum capability.');
    }
    requireCondition(event.source.kind === this.snapshot.device.kind && event.source.deviceProfileId === this.snapshot.device.id,
      'judge.input.source', 'Input belongs to another device.');
    readString(event.source.connectionId, 'judge.input.connection');
    requireCondition(this.connectionId === null || this.connectionId === event.source.connectionId, 'judge.input.connection', 'Pause before changing connections.');

    const time = judgmentTime(event.sessionTimeMs, this.snapshot.calibration);
    this.advanceMusicalTime(time);
    this.rawTimeMs = event.sessionTimeMs;
    // O horizonte fecha antes da ação: uma entrada posterior ao fim não pertence à tentativa.
    if (this.complete) return;
    requireCondition(this.inputCount < limits.maximumInputEvents, 'judge.inputs', 'Input capacity reached.', 'resource-limit');
    this.lastSequence = event.sequence;
    this.inputCount++;
    this.connectionId = event.source.connectionId;
    this.activeFrets = event.activeFrets;
    this.releasedSinceHit |= event.releasedFrets;
    // Caudas no mesmo instante já foram concluídas; só uma mudança estritamente anterior ao fim quebra.
    this.breakMismatchedSustains(time, event.sequence);

    const next = this.notes[this.cursor];
    const candidate = next && time >= next.timeMs - this.snapshot.rules.hitWindow.earlyMs ? next : undefined;
    const automaticStrum = event.strum === null && this.snapshot.config.automaticStrum
      && event.pressedFrets !== 0 && candidate?.note.articulation === 'strum'
      && event.activeFrets === candidate.note.frets;
    if (event.strum !== null || automaticStrum) {
      if (!candidate) this.extraStrum(event, time);
      else if (event.activeFrets === candidate.note.frets) this.hit(candidate, event, time, 'strum');
      else this.wrongFrets(candidate, event, time);
      return;
    }

    const transitioned = event.pressedFrets !== 0 || event.releasedFrets !== 0;
    if (!candidate || !transitioned || event.activeFrets !== candidate.note.frets) return;
    if (candidate.note.articulation === 'strum') {
      this.sawMissingStrum = true;
      return;
    }
    if (candidate.note.articulation === 'hopo') {
      if (!this.hopoEligible(candidate)) {
        this.sawMissingStrum = true;
        return;
      }
      this.hit(candidate, event, time, 'hopo');
      return;
    }
    const previous = this.notes[this.cursor - 1];
    const repeated = this.previousHit && previous?.note.frets === candidate.note.frets;
    if (repeated && (!(this.releasedSinceHit & candidate.note.frets) || !(event.pressedFrets & candidate.note.frets))) return;
    this.hit(candidate, event, time, 'tap');
  }

  getEvaluation(): SessionEvaluation {
    const goals = this.snapshot.config.goals;
    const sustainSamples = this.completedSustains + this.brokenSustains;
    return immutableCopy({
      sessionId: this.snapshot.id,
      throughTimeMs: this.throughTimeMs,
      pendingSustains: this.activeSustains.length,
      judgmentCount: this.records.size,
      judgmentRecords: 'complete',
      requiredTechniqueDataComplete: (!goals.requireArticulation || this.hitNotes > 0)
        && (!goals.requireStrumDirection || (this.directionSamples > 0 && !this.directionUnavailable))
        && (!goals.requireFullSustains || (sustainSamples > 0 && !this.sustainUnavailable && this.activeSustains.length === 0)),
      metrics: {
        plannedNotes: this.notes.length,
        hitNotes: this.hitNotes,
        missedNotes: this.missedNotes,
        unjudgedNotes: this.notes.length - this.cursor,
        extraStrums: this.extraStrums,
        brokenSustains: this.brokenSustains,
        bestCombo: this.bestCombo,
        finalCombo: this.combo,
        noteAccuracy: ratio(this.hitNotes, this.cursor, 'no-samples'),
        timing: this.hitNotes === 0 ? { status: 'unavailable', reason: 'no-samples' } : {
          status: 'available',
          unit: 'milliseconds',
          sampleCount: this.hitNotes,
          meanErrorMs: this.meanErrorMs,
          meanAbsoluteErrorMs: this.meanAbsoluteErrorMs,
          populationStdDevMs: Math.min(
            Math.max(this.snapshot.rules.hitWindow.earlyMs, this.snapshot.rules.hitWindow.lateMs),
            Math.sqrt(Math.max(0, this.squaredDeviation / this.hitNotes)),
          ),
        },
        articulationCompliance: ratio(this.articulationPassed, this.hitNotes, 'no-samples'),
        strumDirectionCompliance: ratio(
          this.directionPassed,
          this.directionSamples,
          !this.directionApplicable ? 'not-applicable' : this.directionUnavailable ? 'unsupported-capability' : 'no-samples',
        ),
        sustainCompletion: ratio(
          this.completedSustains,
          sustainSamples,
          this.sustainApplicable ? 'no-samples' : 'not-applicable',
        ),
      },
    });
  }

  private advanceMusicalTime(time: number): void {
    this.completeSustains(time);
    let next = this.notes[this.cursor];
    while (next && next.deadlineMs < time) {
      this.missedNotes++;
      this.records.append({
        sequence: this.records.size,
        timeMs: next.deadlineMs,
        combo: this.changeCombo(false),
        kind: 'note-miss',
        cause: this.sawMissingStrum ? 'missing-strum' : 'window-expired',
        noteId: next.note.id,
        inputSequence: null,
        timingErrorMs: null,
      });
      this.consume(false, false);
      next = this.notes[this.cursor];
    }
    this.throughTimeMs = time;
  }

  private completeSustains(time: number): void {
    while ((this.activeSustains[0]?.endTimeMs ?? Number.POSITIVE_INFINITY) <= time) {
      const sustain = this.activeSustains.shift();
      if (!sustain) return;
      this.completedSustains++;
      this.records.append({
        sequence: this.records.size,
        timeMs: sustain.endTimeMs,
        combo: this.preserveCombo(),
        kind: 'sustain',
        noteId: sustain.noteId,
        inputSequence: null,
        outcome: 'completed',
        heldDurationMs: sustain.requiredDurationMs,
        requiredDurationMs: sustain.requiredDurationMs,
        technique: { objective: 'sustain', outcome: 'passed', reason: null },
      });
    }
  }

  private breakMismatchedSustains(time: number, inputSequence: number | null): void {
    for (let index = 0; index < this.activeSustains.length;) {
      const sustain = this.activeSustains[index];
      if (!sustain || sustain.frets === this.activeFrets) {
        index++;
        continue;
      }
      this.activeSustains.splice(index, 1);
      this.brokenSustains++;
      this.hopoArmed = false;
      this.records.append({
        sequence: this.records.size,
        timeMs: time,
        combo: this.changeCombo(false),
        kind: 'sustain',
        noteId: sustain.noteId,
        inputSequence,
        outcome: 'broken',
        heldDurationMs: this.heldDuration(sustain, time),
        requiredDurationMs: sustain.requiredDurationMs,
        technique: { objective: 'sustain', outcome: 'failed', reason: 'frets-changed-during-sustain' },
      });
    }
  }

  private heldDuration(sustain: ActiveSustain, time: number): number {
    return Math.max(0, Math.min(time, sustain.endTimeMs) - sustain.startedAtMs);
  }

  private hopoEligible(candidate: ScheduledNote): boolean {
    const previous = this.notes[this.cursor - 1];
    return this.hopoArmed && this.previousHit && previous !== undefined && previous.note.frets !== candidate.note.frets;
  }

  private extraStrum(event: NormalizedInputEvent, time: number): void {
    this.extraStrums++;
    this.hopoArmed = false;
    this.records.append({
      sequence: this.records.size,
      timeMs: time,
      combo: this.changeCombo(false),
      kind: 'extra-strum',
      noteId: null,
      inputSequence: event.sequence,
      timingErrorMs: null,
    });
  }

  private wrongFrets(candidate: ScheduledNote, event: NormalizedInputEvent, time: number): void {
    this.missedNotes++;
    this.records.append({
      sequence: this.records.size,
      timeMs: time,
      combo: this.changeCombo(false),
      kind: 'note-miss',
      cause: 'wrong-frets',
      noteId: candidate.note.id,
      inputSequence: event.sequence,
      timingErrorMs: time - candidate.timeMs,
      activeFrets: event.activeFrets,
      missingFrets: (candidate.note.frets & ~event.activeFrets & 31) as FretMask,
      extraFrets: (event.activeFrets & ~candidate.note.frets & 31) as FretMask,
    });
    this.consume(false, false);
  }

  private hit(
    candidate: ScheduledNote,
    event: NormalizedInputEvent,
    time: number,
    trigger: 'strum' | 'hopo' | 'tap',
  ): void {
    const error = time - candidate.timeMs;
    this.hitNotes++;
    const delta = error - this.meanErrorMs;
    this.meanErrorMs += delta / this.hitNotes;
    this.squaredDeviation += delta * (error - this.meanErrorMs);
    this.meanAbsoluteErrorMs += (Math.abs(error) - this.meanAbsoluteErrorMs) / this.hitNotes;

    const hopoWasEligible = candidate.note.articulation === 'hopo' && this.hopoEligible(candidate);
    const articulationFailed = candidate.note.articulation === 'tap' && trigger === 'strum'
      ? 'strum-used-for-tap' as const
      : candidate.note.articulation === 'hopo' && trigger === 'strum' && hopoWasEligible
        ? 'voluntary-strum-on-hopo' as const
        : null;
    const articulation: TechniqueAssessment = {
      objective: 'articulation',
      outcome: articulationFailed === null ? 'passed' : 'failed',
      reason: articulationFailed,
    };
    if (!articulationFailed) this.articulationPassed++;

    const expected = candidate.note.expectedStrumDirection;
    const direction: TechniqueAssessment = expected === null
      ? { objective: 'strum-direction', outcome: 'not-applicable', reason: null }
      : event.strum === 'unknown' || event.strum === null
        ? { objective: 'strum-direction', outcome: 'not-evaluated', reason: event.strum === null ? 'no-strum-observed' : 'unknown-strum-direction' }
        : { objective: 'strum-direction', outcome: event.strum === expected ? 'passed' : 'failed', reason: event.strum === expected ? null : 'wrong-strum-direction' };
    if (direction.outcome === 'not-evaluated') this.directionUnavailable = true;
    if (direction.outcome === 'passed' || direction.outcome === 'failed') this.directionSamples++;
    if (direction.outcome === 'passed') this.directionPassed++;

    this.records.append({
      sequence: this.records.size,
      timeMs: time,
      combo: this.changeCombo(true),
      kind: 'note-hit',
      noteId: candidate.note.id,
      inputSequence: event.sequence,
      timingErrorMs: error,
      trigger,
      technique: [articulation, direction],
    });

    if (candidate.note.durationTicks > 0) this.beginSustain(candidate, time, event.sequence);
    const armsHopo = trigger === 'strum' || trigger === 'hopo';
    this.consume(true, armsHopo);
  }

  private beginSustain(candidate: ScheduledNote, hitTimeMs: number, inputSequence: number): void {
    const startedAtMs = Math.max(hitTimeMs, candidate.timeMs);
    const requiredDurationMs = Math.max(0, candidate.endTimeMs - startedAtMs);
    if (hitTimeMs >= candidate.endTimeMs) {
      this.sustainUnavailable = true;
      this.records.append({
        sequence: this.records.size,
        timeMs: hitTimeMs,
        combo: this.preserveCombo(),
        kind: 'sustain',
        noteId: candidate.note.id,
        inputSequence,
        outcome: 'not-evaluated',
        heldDurationMs: 0,
        requiredDurationMs,
        technique: { objective: 'sustain', outcome: 'not-evaluated', reason: 'head-after-tail' },
      });
      return;
    }
    this.activeSustains.push({
      noteId: candidate.note.id,
      frets: candidate.note.frets,
      startedAtMs,
      endTimeMs: candidate.endTimeMs,
      requiredDurationMs,
    });
  }

  private changeCombo(hit: boolean): ComboChange {
    const before = this.combo;
    this.combo = hit ? before + 1 : 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    return { before, after: this.combo, effect: hit ? 'increment' : 'reset' };
  }

  private preserveCombo(): ComboChange {
    return { before: this.combo, after: this.combo, effect: 'preserve' };
  }

  private consume(hit: boolean, hopoArmed: boolean): void {
    this.cursor++;
    this.previousHit = hit;
    this.hopoArmed = hopoArmed;
    this.releasedSinceHit = 0;
    this.sawMissingStrum = false;
  }
}
