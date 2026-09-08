import type {
  AnalysisSlice,
  ChartNote,
  DiagnosticCode,
  EvidenceReference,
  Fret,
  FretMask,
  FretAccuracyMetric,
  JudgmentEvent,
  NormalizedInputEvent,
  NoteFrets,
  RatioMetric,
  RecordAvailability,
  SessionAnalysisReport,
  SessionSnapshot,
  StrumDirectionMetric,
  Technique,
  TimingMetrics,
  TrainingDiagnostic,
  TransitionAccuracyMetric,
} from '../domain';
import { FRET_BITS } from '../domain/music';
import { immutableCopy } from '../domain/immutable';
import { ENGINE_LIMITS as limits } from '../domain/limits';
import { countFrets } from '../domain/validation';
import { judgmentTime, ticksToMilliseconds } from '../timing';

export const ANALYSIS_POLICY = Object.freeze({ id: 'fretsense-analysis', version: '1.1.0' });

const FRET_ORDER: readonly Fret[] = ['G', 'R', 'Y', 'B', 'O'];
const MINIMUM_TREND_SAMPLES = 8;
const MINIMUM_DIRECTION_SAMPLES = 4;
const TIMING_TREND_THRESHOLD_MS = 15;

interface ExpectedNote {
  readonly note: ChartNote;
  readonly timeMs: number;
  readonly judgment: Extract<JudgmentEvent, { kind: 'note-hit' | 'note-miss' }>;
}

interface Attack {
  readonly timeMs: number;
  readonly frets: FretMask;
  readonly inputSequence: number;
  readonly judgmentSequence: number | null;
  readonly linkedNoteId: string | null;
  readonly segmentId: string | null;
}

type AlignmentOperation =
  | { readonly kind: 'pair'; readonly expected: ExpectedNote; readonly attack: Attack }
  | { readonly kind: 'omission'; readonly expected: ExpectedNote }
  | { readonly kind: 'extra'; readonly attack: Attack; readonly nearbyNoteId: string | null };

interface DiagnosticAccumulator {
  basis: 'observed' | 'inferred';
  occurrences: number;
  sampleCount: number;
  evidence: EvidenceReference[];
}

function ratio(numerator: number, denominator: number, reason: 'no-samples' | 'not-applicable' = 'no-samples'): RatioMetric {
  return denominator > 0
    ? { status: 'available', unit: 'ratio', numerator, denominator, value: numerator / denominator }
    : { status: 'unavailable', reason };
}

function timing(events: readonly Extract<JudgmentEvent, { kind: 'note-hit' }>[]): TimingMetrics {
  if (events.length === 0) return { status: 'unavailable', reason: 'no-samples' };
  const errors = events.map((event) => event.timingErrorMs);
  const meanErrorMs = errors.reduce((total, value) => total + value, 0) / errors.length;
  const meanAbsoluteErrorMs = errors.reduce((total, value) => total + Math.abs(value), 0) / errors.length;
  const variance = errors.reduce((total, value) => total + (value - meanErrorMs) ** 2, 0) / errors.length;
  return {
    status: 'available',
    unit: 'milliseconds',
    sampleCount: errors.length,
    meanErrorMs,
    meanAbsoluteErrorMs,
    populationStdDevMs: Math.sqrt(variance),
  };
}

function evidence(
  sessionId: string,
  noteIds: readonly string[],
  inputSequences: readonly number[],
  judgmentSequences: readonly number[],
): EvidenceReference {
  return {
    sessionId,
    noteIds: noteIds.slice(0, limits.maximumDiagnosticEvidence),
    inputSequences: inputSequences.slice(0, limits.maximumDiagnosticEvidence),
    judgmentSequences: judgmentSequences.slice(0, limits.maximumDiagnosticEvidence),
  };
}

function attackJudgments(attack: Attack): readonly number[] {
  return attack.judgmentSequence === null ? [] : [attack.judgmentSequence];
}

function nearestExpected(expected: readonly ExpectedNote[], timeMs: number, maximumDistanceMs: number): ExpectedNote | undefined {
  let low = 0;
  let high = expected.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((expected[middle]?.timeMs ?? Number.POSITIVE_INFINITY) < timeMs) low = middle + 1;
    else high = middle;
  }
  const before = expected[low - 1];
  const after = expected[low];
  const nearest = before && after
    ? Math.abs(before.timeMs - timeMs) <= Math.abs(after.timeMs - timeMs) ? before : after
    : before ?? after;
  return nearest && Math.abs(nearest.timeMs - timeMs) <= maximumDistanceMs ? nearest : undefined;
}

function directAlignment(expected: readonly ExpectedNote[], attacks: readonly Attack[]): AlignmentOperation[] {
  const attackByNote = new Map(attacks.filter((attack) => attack.linkedNoteId !== null)
    .map((attack) => [attack.linkedNoteId as string, attack]));
  const used = new Set<number>();
  const operations: AlignmentOperation[] = expected.map((item) => {
    const attack = attackByNote.get(item.note.id);
    if (!attack) return { kind: 'omission', expected: item };
    used.add(attack.inputSequence);
    return { kind: 'pair', expected: item, attack };
  });
  for (const attack of attacks) {
    if (!used.has(attack.inputSequence)) operations.push({ kind: 'extra', attack, nearbyNoteId: attack.linkedNoteId });
  }
  return operations;
}

function alignSegment(
  expected: readonly ExpectedNote[],
  attacks: readonly Attack[],
  maximumDistanceMs: number,
): AlignmentOperation[] {
  const rows = expected.length + 1;
  const columns = attacks.length + 1;
  const costs = Array.from({ length: rows }, () => new Float64Array(columns));
  const choices = Array.from({ length: rows }, () => new Uint8Array(columns));
  for (let row = 1; row < rows; row += 1) {
    (costs[row] as Float64Array)[0] = row;
    (choices[row] as Uint8Array)[0] = 2;
  }
  for (let column = 1; column < columns; column += 1) {
    (costs[0] as Float64Array)[column] = column;
    (choices[0] as Uint8Array)[column] = 3;
  }
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const note = expected[row - 1] as ExpectedNote;
      const attack = attacks[column - 1] as Attack;
      const deletion = (costs[row - 1] as Float64Array)[column] as number + 1;
      const insertion = (costs[row] as Float64Array)[column - 1] as number + 1;
      const distance = Math.abs(note.timeMs - attack.timeMs);
      const pairing = distance <= maximumDistanceMs
        ? (costs[row - 1] as Float64Array)[column - 1] as number
          + (note.note.frets === attack.frets ? 0 : 0.75)
          + distance / Math.max(1, maximumDistanceMs) * 0.2
        : Number.POSITIVE_INFINITY;
      if (pairing <= deletion && pairing <= insertion) {
        (costs[row] as Float64Array)[column] = pairing;
        (choices[row] as Uint8Array)[column] = 1;
      } else if (deletion <= insertion) {
        (costs[row] as Float64Array)[column] = deletion;
        (choices[row] as Uint8Array)[column] = 2;
      } else {
        (costs[row] as Float64Array)[column] = insertion;
        (choices[row] as Uint8Array)[column] = 3;
      }
    }
  }

  const reversed: AlignmentOperation[] = [];
  let row = expected.length;
  let column = attacks.length;
  while (row > 0 || column > 0) {
    const choice = (choices[row] as Uint8Array)[column];
    if (choice === 1) {
      reversed.push({ kind: 'pair', expected: expected[row - 1] as ExpectedNote, attack: attacks[column - 1] as Attack });
      row -= 1;
      column -= 1;
    } else if (choice === 2) {
      reversed.push({ kind: 'omission', expected: expected[row - 1] as ExpectedNote });
      row -= 1;
    } else {
      const attack = attacks[column - 1] as Attack;
      reversed.push({ kind: 'extra', attack, nearbyNoteId: nearestExpected(expected, attack.timeMs, maximumDistanceMs)?.note.id ?? null });
      column -= 1;
    }
  }
  return reversed.reverse();
}

function singleFretIndex(mask: NoteFrets): number | null {
  if (countFrets(mask) !== 1) return null;
  return [1, 2, 4, 8, 16].indexOf(mask);
}

/** Análise posterior pura e limitada; nunca altera eventos nem decisões do julgador. */
export function analyzeSession(
  snapshot: SessionSnapshot,
  inputs: readonly NormalizedInputEvent[],
  judgments: readonly JudgmentEvent[],
  availability: { readonly inputs: RecordAvailability; readonly judgments: RecordAvailability },
): SessionAnalysisReport {
  const noteById = new Map(snapshot.chart.notes.map((note) => [note.id, note]));
  const inputBySequence = new Map(inputs.map((input) => [input.sequence, input]));
  const noteJudgments = judgments.filter(
    (event): event is Extract<JudgmentEvent, { kind: 'note-hit' | 'note-miss' }> =>
      event.kind === 'note-hit' || event.kind === 'note-miss',
  );
  const expected = noteJudgments.flatMap((judgment) => {
    const note = noteById.get(judgment.noteId);
    return note ? [{ note, judgment, timeMs: ticksToMilliseconds(note.tick, snapshot.chart.bpm) }] : [];
  });
  const maximumDistanceMs = Math.max(snapshot.rules.hitWindow.earlyMs, snapshot.rules.hitWindow.lateMs) * 2;
  const attacks: Attack[] = [];
  for (const judgment of judgments) {
    const inputSequence = judgment.kind === 'note-hit'
      || (judgment.kind === 'note-miss' && judgment.cause === 'wrong-frets')
      || judgment.kind === 'extra-strum' ? judgment.inputSequence : null;
    if (inputSequence === null) continue;
    const input = inputBySequence.get(inputSequence);
    if (!input) continue;
    const linkedNoteId = judgment.kind === 'note-hit' || judgment.kind === 'note-miss' ? judgment.noteId : null;
    const linkedNote = linkedNoteId ? noteById.get(linkedNoteId) : undefined;
    const nearby = linkedNote ?? nearestExpected(expected, judgment.timeMs, maximumDistanceMs)?.note;
    attacks.push({
      timeMs: judgment.timeMs,
      frets: input.activeFrets,
      inputSequence,
      judgmentSequence: judgment.sequence,
      linkedNoteId,
      segmentId: nearby?.origin.segmentId ?? null,
    });
  }
  const referencedInputs = new Set(attacks.map((attack) => attack.inputSequence));
  for (const input of inputs) {
    if (referencedInputs.has(input.sequence) || input.strum !== null || input.activeFrets === 0
      || (input.pressedFrets === 0 && input.releasedFrets === 0)) continue;
    const timeMs = judgmentTime(input.sessionTimeMs, snapshot.calibration);
    const nearby = nearestExpected(expected, timeMs, maximumDistanceMs);
    if (!nearby || nearby.note.articulation === 'strum' || input.activeFrets === nearby.note.frets) continue;
    attacks.push({
      timeMs,
      frets: input.activeFrets,
      inputSequence: input.sequence,
      judgmentSequence: null,
      linkedNoteId: null,
      segmentId: nearby.note.origin.segmentId,
    });
  }
  attacks.sort((first, second) => first.timeMs - second.timeMs || first.inputSequence - second.inputSequence);

  const expectedBySegment = new Map<string, ExpectedNote[]>();
  const attacksBySegment = new Map<string, Attack[]>();
  for (const item of expected) {
    const group = expectedBySegment.get(item.note.origin.segmentId) ?? [];
    group.push(item);
    expectedBySegment.set(item.note.origin.segmentId, group);
  }
  for (const attack of attacks) {
    if (attack.segmentId === null) continue;
    const group = attacksBySegment.get(attack.segmentId) ?? [];
    group.push(attack);
    attacksBySegment.set(attack.segmentId, group);
  }

  const cellsVisited = [...expectedBySegment].reduce((total, [segmentId, notes]) =>
    total + (notes.length + 1) * ((attacksBySegment.get(segmentId)?.length ?? 0) + 1), 0);
  const costLimited = cellsVisited > limits.maximumAnalysisAlignmentCells;
  const operations: AlignmentOperation[] = [];
  for (const [segmentId, notes] of expectedBySegment) {
    const segmentAttacks = attacksBySegment.get(segmentId) ?? [];
    operations.push(...(costLimited ? directAlignment(notes, segmentAttacks)
      : alignSegment(notes, segmentAttacks, maximumDistanceMs)));
  }
  for (const attack of attacks) {
    if (attack.segmentId === null) operations.push({ kind: 'extra', attack, nearbyNoteId: null });
  }

  const accumulators = new Map<DiagnosticCode, DiagnosticAccumulator>();
  const addDiagnostic = (
    code: DiagnosticCode,
    basis: 'observed' | 'inferred',
    sampleCount: number,
    item: EvidenceReference,
    occurrences = 1,
  ) => {
    const current = accumulators.get(code) ?? { basis, occurrences: 0, sampleCount, evidence: [] };
    current.occurrences += occurrences;
    current.sampleCount = Math.max(current.sampleCount, sampleCount);
    if (current.evidence.length < limits.maximumDiagnosticEvidence) current.evidence.push(item);
    accumulators.set(code, current);
  };

  const pairs = operations.filter((operation): operation is Extract<AlignmentOperation, { kind: 'pair' }> => operation.kind === 'pair');
  const pairedByNote = new Map(pairs.map((pair) => [pair.expected.note.id, pair]));
  const inversionNotes = new Set<string>();
  for (let index = 0; index + 1 < operations.length; index += 1) {
    const first = operations[index];
    const second = operations[index + 1];
    if (first?.kind !== 'pair' || second?.kind !== 'pair') continue;
    if (first.expected.note.origin.segmentId !== second.expected.note.origin.segmentId
      || countFrets(first.expected.note.frets) !== 1 || countFrets(second.expected.note.frets) !== 1
      || first.expected.note.frets === second.expected.note.frets
      || first.attack.frets !== second.expected.note.frets || second.attack.frets !== first.expected.note.frets) continue;
    inversionNotes.add(first.expected.note.id);
    inversionNotes.add(second.expected.note.id);
    addDiagnostic('sequence-inversion', 'observed', expected.length, evidence(snapshot.id,
      [first.expected.note.id, second.expected.note.id],
      [first.attack.inputSequence, second.attack.inputSequence],
      [...attackJudgments(first.attack), ...attackJudgments(second.attack)]));
    index += 1;
  }

  for (const operation of operations) {
    if (operation.kind === 'omission') {
      addDiagnostic('omission', 'observed', expected.length, evidence(snapshot.id,
        [operation.expected.note.id], [], [operation.expected.judgment.sequence]));
      continue;
    }
    if (operation.kind === 'extra') {
      addDiagnostic('extra-input', 'observed', attacks.length, evidence(snapshot.id,
        operation.nearbyNoteId ? [operation.nearbyNoteId] : [],
        [operation.attack.inputSequence], attackJudgments(operation.attack)));
      continue;
    }
    const { note } = operation.expected;
    if (note.frets === operation.attack.frets || inversionNotes.has(note.id)) continue;
    const detail = countFrets(note.frets) > 1
      ? (operation.attack.frets & note.frets) === operation.attack.frets ? 'chord-incomplete' as const
        : (operation.attack.frets & note.frets) === note.frets ? 'chord-extra-frets' as const
          : 'chord-substitution' as const
      : 'fret-substitution' as const;
    addDiagnostic(detail, 'observed', expected.length, evidence(snapshot.id, [note.id],
      [operation.attack.inputSequence], attackJudgments(operation.attack)));
  }

  const hitEvents = judgments.filter((event): event is Extract<JudgmentEvent, { kind: 'note-hit' }> => event.kind === 'note-hit');
  const timingMetrics = timing(hitEvents);
  if (timingMetrics.status === 'available' && timingMetrics.sampleCount >= MINIMUM_TREND_SAMPLES
    && Math.abs(timingMetrics.meanErrorMs) >= TIMING_TREND_THRESHOLD_MS) {
    addDiagnostic(timingMetrics.meanErrorMs < 0 ? 'timing-early-trend' : 'timing-late-trend', 'inferred',
      timingMetrics.sampleCount, evidence(snapshot.id, hitEvents.map((event) => event.noteId),
        hitEvents.map((event) => event.inputSequence), hitEvents.map((event) => event.sequence)));
  }

  const sustainEvents = judgments.filter(
    (event): event is Extract<JudgmentEvent, { kind: 'sustain' }> =>
      event.kind === 'sustain' && (event.outcome === 'completed' || event.outcome === 'broken'),
  );
  for (const event of sustainEvents) {
    if (event.outcome === 'broken') addDiagnostic('sustain-short', 'observed', sustainEvents.length,
      evidence(snapshot.id, [event.noteId], event.inputSequence === null ? [] : [event.inputSequence], [event.sequence]));
  }
  const directionEvents = hitEvents.flatMap((event) => event.technique
    .filter((assessment) => assessment.objective === 'strum-direction' && assessment.outcome === 'failed')
    .map(() => event));
  const directionSampleCount = hitEvents.filter((event) => event.technique.some((assessment) =>
    assessment.objective === 'strum-direction' && (assessment.outcome === 'passed' || assessment.outcome === 'failed'))).length;
  for (const event of directionEvents) addDiagnostic('wrong-strum-direction', 'observed', directionSampleCount,
    evidence(snapshot.id, [event.noteId], [event.inputSequence], [event.sequence]));
  for (const event of hitEvents) {
    const articulation = event.technique.find((assessment) => assessment.objective === 'articulation');
    const code = articulation?.reason === 'strum-used-for-tap' ? 'tap-strummed' as const
      : articulation?.reason === 'voluntary-strum-on-hopo' ? 'hopo-strummed' as const : null;
    if (code) addDiagnostic(code, 'observed', hitEvents.length,
      evidence(snapshot.id, [event.noteId], [event.inputSequence], [event.sequence]));
  }

  const timingByNote = new Map(hitEvents.map((event) => [event.noteId, event]));
  const ascending: Extract<JudgmentEvent, { kind: 'note-hit' }>[] = [];
  const descending: Extract<JudgmentEvent, { kind: 'note-hit' }>[] = [];
  for (const notes of expectedBySegment.values()) {
    for (let index = 1; index < notes.length; index += 1) {
      const previous = notes[index - 1] as ExpectedNote;
      const current = notes[index] as ExpectedNote;
      const from = singleFretIndex(previous.note.frets);
      const to = singleFretIndex(current.note.frets);
      const event = timingByNote.get(current.note.id);
      if (from === null || to === null || from === to || !event) continue;
      (to > from ? ascending : descending).push(event);
    }
  }
  if (ascending.length >= MINIMUM_DIRECTION_SAMPLES && descending.length >= MINIMUM_DIRECTION_SAMPLES) {
    const ascendingMean = ascending.reduce((total, event) => total + event.timingErrorMs, 0) / ascending.length;
    const descendingMean = descending.reduce((total, event) => total + event.timingErrorMs, 0) / descending.length;
    if (Math.abs(ascendingMean - descendingMean) >= TIMING_TREND_THRESHOLD_MS) {
      const samples = [...ascending, ...descending];
      addDiagnostic('transition-direction-gap', 'inferred', samples.length, evidence(snapshot.id,
        samples.map((event) => event.noteId), samples.map((event) => event.inputSequence), samples.map((event) => event.sequence)));
    }
  }

  const fretAccuracy: FretAccuracyMetric[] = FRET_ORDER.map((fret) => {
    const bit = FRET_BITS[fret];
    const relevant = expected.filter((item) => (item.note.frets & bit) !== 0);
    const correct = relevant.filter((item) => ((pairedByNote.get(item.note.id)?.attack.frets ?? 0) & bit) !== 0).length;
    const unexpectedCount = operations.filter((operation) => operation.kind === 'pair'
      ? (operation.expected.note.frets & bit) === 0 && (operation.attack.frets & bit) !== 0
      : operation.kind === 'extra' && (operation.attack.frets & bit) !== 0).length;
    return { fret, accuracy: ratio(correct, relevant.length, 'not-applicable'), unexpectedCount };
  });

  const transitionMap = new Map<string, { from: NoteFrets; to: NoteFrets; numerator: number; denominator: number }>();
  for (const notes of expectedBySegment.values()) {
    for (let index = 1; index < notes.length; index += 1) {
      const previous = notes[index - 1] as ExpectedNote;
      const current = notes[index] as ExpectedNote;
      const key = `${previous.note.frets}>${current.note.frets}`;
      const metric = transitionMap.get(key) ?? { from: previous.note.frets, to: current.note.frets, numerator: 0, denominator: 0 };
      metric.denominator += 1;
      if (pairedByNote.get(previous.note.id)?.attack.frets === previous.note.frets
        && pairedByNote.get(current.note.id)?.attack.frets === current.note.frets) metric.numerator += 1;
      transitionMap.set(key, metric);
    }
  }
  const transitionAccuracy: TransitionAccuracyMetric[] = [...transitionMap.values()]
    .map((metric) => ({ from: metric.from, to: metric.to, accuracy: ratio(metric.numerator, metric.denominator) }));

  const chordNotes = expected.filter((item) => countFrets(item.note.frets) > 1);
  let correctChords = 0;
  let incompleteCount = 0;
  let extraFretsCount = 0;
  let substitutionCount = 0;
  let omittedCount = 0;
  for (const item of chordNotes) {
    const observed = pairedByNote.get(item.note.id)?.attack.frets;
    if (observed === undefined) omittedCount += 1;
    else if (observed === item.note.frets) correctChords += 1;
    else if ((observed & item.note.frets) === observed) incompleteCount += 1;
    else if ((observed & item.note.frets) === item.note.frets) extraFretsCount += 1;
    else substitutionCount += 1;
  }

  const requiredDuration = sustainEvents.reduce((total, event) => total + event.requiredDurationMs, 0);
  const heldDuration = sustainEvents.reduce((total, event) => total + Math.min(event.heldDurationMs, event.requiredDurationMs), 0);
  const sustainApplicable = snapshot.chart.notes.some((note) => note.durationTicks > 0);
  const sustainDuration = requiredDuration > 0 ? {
    status: 'available' as const,
    unit: 'ratio' as const,
    numerator: heldDuration,
    denominator: requiredDuration,
    value: heldDuration / requiredDuration,
    sampleCount: sustainEvents.length,
  } : { status: 'unavailable' as const, reason: sustainApplicable ? 'no-samples' as const : 'not-applicable' as const };

  const strumDirection: StrumDirectionMetric[] = (['down', 'up'] as const).map((direction): StrumDirectionMetric => {
    const relevant = hitEvents.filter((event) => noteById.get(event.noteId)?.expectedStrumDirection === direction);
    const passed = relevant.filter((event) => event.technique.some((assessment) =>
      assessment.objective === 'strum-direction' && assessment.outcome === 'passed')).length;
    const evaluated = relevant.filter((event) => event.technique.some((assessment) =>
      assessment.objective === 'strum-direction' && ['passed', 'failed'].includes(assessment.outcome))).length;
    return { direction, compliance: relevant.length === 0 ? { status: 'unavailable', reason: 'not-applicable' }
      : snapshot.device.capabilities.strum !== 'directional' ? { status: 'unavailable', reason: 'unsupported-capability' }
        : ratio(passed, evaluated) };
  });

  const diagnostics: TrainingDiagnostic[] = [...accumulators].map(([code, value]) => ({
    id: `${ANALYSIS_POLICY.id}:${code}`,
    code,
    basis: value.basis,
    occurrences: value.occurrences,
    sampleCount: value.sampleCount,
    evidence: value.evidence,
  }));
  const createSlices = (kind: 'segment' | 'technique'): AnalysisSlice[] => {
    const groups = new Map<string, ExpectedNote[]>();
    for (const item of expected) {
      const mixedTechnique: Technique = item.note.durationTicks > 0 ? 'sustains'
        : countFrets(item.note.frets) > 1 ? 'chords'
          : item.note.articulation === 'hopo' ? 'hopo'
            : item.note.articulation === 'tap' ? 'tapping'
              : item.note.expectedStrumDirection !== null ? 'alternate-strum' : 'single-strum';
      const key = kind === 'segment' ? item.note.origin.segmentId
        : snapshot.config.technique === 'mixed' ? mixedTechnique : item.note.origin.technique;
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    return [...groups].map(([id, notes]) => {
      const noteIds = new Set(notes.map((item) => item.note.id));
      const hits = notes.filter((item) => item.judgment.kind === 'note-hit').length;
      const sliceHits = notes.flatMap((item) => {
        const event = timingByNote.get(item.note.id);
        return event ? [event] : [];
      });
      return {
        id,
        technique: (kind === 'technique' ? id : notes[0]?.note.origin.technique) as Technique,
        expectedNotes: notes.length,
        noteAccuracy: ratio(hits, notes.length),
        timing: timing(sliceHits),
        diagnosticIds: diagnostics.filter((diagnostic) => diagnostic.evidence.some((item) =>
          item.noteIds.some((noteId) => noteIds.has(noteId)))).map((diagnostic) => diagnostic.id),
      };
    });
  };

  const techniques = createSlices('technique');
  const allSegments = createSlices('segment');
  const segments = allSegments.slice(0, limits.maximumAnalysisSlices);
  const limitations: SessionAnalysisReport['limitations'][number][] = [];
  if (availability.inputs !== 'complete') limitations.push('input-recording-incomplete');
  if (availability.judgments !== 'complete') limitations.push('judgment-recording-incomplete');
  if (costLimited) limitations.push('cost-limit');
  if (allSegments.length > segments.length) limitations.push('slice-limit');
  if (expected.length < snapshot.chart.notes.length) limitations.push('unjudged-notes');
  return immutableCopy({
    schemaVersion: 1,
    policy: ANALYSIS_POLICY,
    status: limitations.length === 0 ? 'complete' : 'partial',
    limitations,
    analyzedNotes: expected.length,
    analyzedInputs: attacks.length,
    timing: timingMetrics,
    alignment: { maximumDistanceMs, cellsVisited },
    fretAccuracy,
    transitionAccuracy,
    chords: {
      accuracy: ratio(correctChords, chordNotes.length, 'not-applicable'),
      incompleteCount,
      extraFretsCount,
      substitutionCount,
      omittedCount,
    },
    sustainDuration,
    strumDirection,
    techniques,
    segments,
    diagnostics,
  });
}
