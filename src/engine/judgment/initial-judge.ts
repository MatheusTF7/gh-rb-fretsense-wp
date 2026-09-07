import type { ChartNote, ComboChange, FretMask, JudgmentEvent, NormalizedInputEvent, RatioMetric, SessionSnapshot, TechniqueAssessment } from '../domain';
import { ENGINE_LIMITS as limits } from '../domain/limits';
import { FRETSENSE_V1_RULE_PROFILE } from '../domain/rules';
import { immutableCopy } from '../domain/immutable';
import { readChoice, readInteger, readNumber, readString, requireCondition, requireSameData } from '../domain/validation';
import { BoundedBuffer } from '../session/bounded-buffer';
import type { SessionEvaluation } from '../session/evaluation';
import { createSessionSnapshot } from '../session/snapshot';
import { getChartEndTime, judgmentTime, ticksToMilliseconds } from '../timing';

interface ScheduledNote { readonly note: ChartNote; readonly timeMs: number; readonly deadlineMs: number }

function ratio(numerator: number, denominator: number, reason: 'no-samples' | 'not-applicable' | 'unsupported-capability'): RatioMetric {
  return denominator > 0 ? { status: 'available', numerator, denominator, value: numerator / denominator }
    : { status: 'unavailable', reason };
}

/** Uma tentativa finita de strum/tap, sem relógio externo, renderização ou tarefas assíncronas. */
export class InitialJudge {
  readonly snapshot: SessionSnapshot;
  private readonly notes: readonly ScheduledNote[];
  private readonly records = new BoundedBuffer<JudgmentEvent>(limits.maximumJudgmentEvents);
  private readonly endTimeMs: number;
  private readonly maximumRawMs: number;
  private readonly directionApplicable: boolean;
  private rawTimeMs = 0;
  private throughTimeMs = -limits.maximumOffsetMs;
  private cursor = 0;
  private previousHit = false;
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
  private directionUnavailable = false;

  constructor(snapshot: SessionSnapshot) {
    readChoice(snapshot.schemaVersion, [1], 'snapshot.schemaVersion');
    requireSameData(snapshot.rules, FRETSENSE_V1_RULE_PROFILE, 'snapshot.rules');
    this.snapshot = createSessionSnapshot(snapshot, { id: snapshot.id, createdAtIso: snapshot.createdAtIso }, snapshot.chart);
    requireCondition(this.snapshot.chart.notes.every((note) => note.articulation !== 'hopo' && note.durationTicks === 0),
      'judge.chart', 'The initial judge supports strum/tap without sustains. HOPO and sustains require stage 08.', 'unsupported');
    this.notes = this.snapshot.chart.notes.map((note) => {
      const timeMs = ticksToMilliseconds(note.tick, this.snapshot.chart.bpm);
      return { note, timeMs, deadlineMs: timeMs + this.snapshot.rules.hitWindow.lateMs };
    });
    this.endTimeMs = getChartEndTime(this.snapshot.chart, this.snapshot.rules);
    this.directionApplicable = this.notes.some(({ note }) => note.expectedStrumDirection !== null);
    this.maximumRawMs = Math.max(0, this.endTimeMs + this.snapshot.calibration.judgmentOffsetMs) + limits.resultGraceMs;
  }

  get complete(): boolean { return this.cursor === this.notes.length && this.throughTimeMs > this.endTimeMs; }
  getEvents(): readonly JudgmentEvent[] { return this.records.snapshot(); }

  /** Preparação/retomada: sincroniza estado sem fabricar ataques ou liberações. */
  setInputBaseline(frets: FretMask): void { this.activeFrets = readInteger(frets, 'judge.baseline', 0, 31) as FretMask; }

  /** O proprietário congela o tempo e não entrega entradas durante a interrupção. */
  pause(): void { this.activeFrets = 0; this.connectionId = null; }

  advance(rawTimeMs: number): void {
    readNumber(rawTimeMs, 'judge.clock', this.rawTimeMs, this.maximumRawMs);
    this.expire(judgmentTime(rawTimeMs, this.snapshot.calibration));
    this.rawTimeMs = rawTimeMs;
  }

  processInput(event: NormalizedInputEvent): void {
    // Valida toda a entrada antes de alterar prazos, combo ou registros.
    readNumber(event.sessionTimeMs, 'judge.input.time', this.rawTimeMs, this.maximumRawMs);
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
    requireCondition(this.inputCount < limits.maximumInputEvents, 'judge.inputs', 'Input capacity reached.', 'resource-limit');

    const time = judgmentTime(event.sessionTimeMs, this.snapshot.calibration);
    this.expire(time);
    this.rawTimeMs = event.sessionTimeMs;
    this.lastSequence = event.sequence;
    this.inputCount++;
    this.connectionId = event.source.connectionId;
    this.activeFrets = event.activeFrets;
    this.releasedSinceHit |= event.releasedFrets;
    const next = this.notes[this.cursor];
    const candidate = next && time >= next.timeMs - this.snapshot.rules.hitWindow.earlyMs ? next : undefined;
    if (event.strum !== null) {
      if (!candidate) {
        this.extraStrums++;
        this.records.append({ sequence: this.records.size, timeMs: time, combo: this.changeCombo(false),
          kind: 'extra-strum', noteId: null, inputSequence: event.sequence, timingErrorMs: null });
      } else if (event.activeFrets === candidate.note.frets) this.hit(candidate, event, time, 'strum');
      else {
        this.missedNotes++;
        this.records.append({ sequence: this.records.size, timeMs: time, combo: this.changeCombo(false),
          kind: 'note-miss', cause: 'wrong-frets', noteId: candidate.note.id, inputSequence: event.sequence,
          timingErrorMs: time - candidate.timeMs, activeFrets: event.activeFrets,
          missingFrets: (candidate.note.frets & ~event.activeFrets & 31) as FretMask,
          extraFrets: (event.activeFrets & ~candidate.note.frets & 31) as FretMask });
        this.consume(false);
      }
      return;
    }
    if (!candidate || !(event.pressedFrets || event.releasedFrets) || event.activeFrets !== candidate.note.frets) return;
    if (candidate.note.articulation === 'strum') { this.sawMissingStrum = true; return; }
    const previous = this.notes[this.cursor - 1];
    const repeated = this.previousHit && previous?.note.frets === candidate.note.frets;
    if (repeated && (!(this.releasedSinceHit & candidate.note.frets) || !(event.pressedFrets & candidate.note.frets))) return;
    this.hit(candidate, event, time, 'tap');
  }

  getEvaluation(): SessionEvaluation {
    const goals = this.snapshot.config.goals;
    return immutableCopy({ sessionId: this.snapshot.id, throughTimeMs: this.throughTimeMs, pendingSustains: 0,
      judgmentCount: this.records.size, judgmentRecords: 'complete',
      requiredTechniqueDataComplete: (!goals.requireArticulation || this.hitNotes > 0)
        && (!goals.requireStrumDirection || (this.directionSamples > 0 && !this.directionUnavailable)) && !goals.requireFullSustains,
      metrics: { plannedNotes: this.notes.length, hitNotes: this.hitNotes, missedNotes: this.missedNotes,
        unjudgedNotes: this.notes.length - this.cursor, extraStrums: this.extraStrums, brokenSustains: 0,
        bestCombo: this.bestCombo, finalCombo: this.combo,
        noteAccuracy: ratio(this.hitNotes, this.cursor, 'no-samples'),
        timing: this.hitNotes === 0 ? { status: 'unavailable', reason: 'no-samples' } : {
          status: 'available', sampleCount: this.hitNotes, meanErrorMs: this.meanErrorMs,
          meanAbsoluteErrorMs: this.meanAbsoluteErrorMs,
          populationStdDevMs: Math.min(Math.max(this.snapshot.rules.hitWindow.earlyMs, this.snapshot.rules.hitWindow.lateMs),
            Math.sqrt(Math.max(0, this.squaredDeviation / this.hitNotes))),
        },
        articulationCompliance: ratio(this.articulationPassed, this.hitNotes, 'no-samples'),
        strumDirectionCompliance: ratio(this.directionPassed, this.directionSamples,
          !this.directionApplicable ? 'not-applicable' : this.directionUnavailable ? 'unsupported-capability' : 'no-samples'),
        sustainCompletion: { status: 'unavailable', reason: 'not-applicable' },
      },
    });
  }

  private expire(time: number): void {
    let next = this.notes[this.cursor];
    while (next && next.deadlineMs < time) {
      this.missedNotes++;
      this.records.append({ sequence: this.records.size, timeMs: next.deadlineMs, combo: this.changeCombo(false),
        kind: 'note-miss', cause: this.sawMissingStrum ? 'missing-strum' : 'window-expired',
        noteId: next.note.id, inputSequence: null, timingErrorMs: null });
      this.consume(false);
      next = this.notes[this.cursor];
    }
    this.throughTimeMs = time;
  }

  private hit(candidate: ScheduledNote, event: NormalizedInputEvent, time: number, trigger: 'strum' | 'tap'): void {
    const error = time - candidate.timeMs;
    this.hitNotes++;
    const delta = error - this.meanErrorMs;
    this.meanErrorMs += delta / this.hitNotes;
    this.squaredDeviation += delta * (error - this.meanErrorMs);
    this.meanAbsoluteErrorMs += (Math.abs(error) - this.meanAbsoluteErrorMs) / this.hitNotes;
    const articulationFailed = candidate.note.articulation === 'tap' && trigger === 'strum';
    const articulation: TechniqueAssessment = { objective: 'articulation', outcome: articulationFailed ? 'failed' : 'passed',
      reason: articulationFailed ? 'strum-used-for-tap' : null };
    if (!articulationFailed) this.articulationPassed++;
    const expected = candidate.note.expectedStrumDirection;
    const direction: TechniqueAssessment = expected === null ? { objective: 'strum-direction', outcome: 'not-applicable', reason: null }
      : event.strum === 'unknown' || event.strum === null
        ? { objective: 'strum-direction', outcome: 'not-evaluated', reason: event.strum === null ? 'no-strum-observed' : 'unknown-strum-direction' }
        : { objective: 'strum-direction', outcome: event.strum === expected ? 'passed' : 'failed', reason: event.strum === expected ? null : 'wrong-strum-direction' };
    if (direction.outcome === 'not-evaluated') this.directionUnavailable = true;
    if (direction.outcome === 'passed' || direction.outcome === 'failed') this.directionSamples++;
    if (direction.outcome === 'passed') this.directionPassed++;
    this.records.append({ sequence: this.records.size, timeMs: time, combo: this.changeCombo(true), kind: 'note-hit',
      noteId: candidate.note.id, inputSequence: event.sequence, timingErrorMs: error, trigger, technique: [articulation, direction] });
    this.consume(true);
  }

  private changeCombo(hit: boolean): ComboChange {
    const before = this.combo;
    this.combo = hit ? before + 1 : 0;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    return { before, after: this.combo, effect: hit ? 'increment' : 'reset' };
  }

  private consume(hit: boolean): void {
    this.cursor++; this.previousHit = hit; this.releasedSinceHit = 0; this.sawMissingStrum = false;
  }
}
