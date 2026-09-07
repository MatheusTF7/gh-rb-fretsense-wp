import { TICKS_PER_QUARTER } from '../domain/music';
import type { Chart, Milliseconds, RuleProfile } from '../domain';
import { ENGINE_LIMITS } from '../domain/limits';
import { readInteger, readNumber } from '../domain/validation';

export function ticksToMilliseconds(ticks: number, bpm: number): Milliseconds {
  readInteger(ticks, 'ticks', 0, ENGINE_LIMITS.maximumTicks);
  readNumber(bpm, 'bpm', ENGINE_LIMITS.minimumBpm, ENGINE_LIMITS.maximumBpm);
  return (ticks * 60_000) / (bpm * TICKS_PER_QUARTER);
}

/** A posição fracionária/negativa serve à visualização; não é uma posição de ChartNote. */
export function millisecondsToTicks(milliseconds: number, bpm: number): number {
  readNumber(milliseconds, 'milliseconds', -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  readNumber(bpm, 'bpm', ENGINE_LIMITS.minimumBpm, ENGINE_LIMITS.maximumBpm);
  return (milliseconds / 60_000) * bpm * TICKS_PER_QUARTER;
}

export function getChartEndTime(chart: Chart, rules: RuleProfile): Milliseconds {
  let end = ticksToMilliseconds(chart.lengthTicks, chart.bpm);
  for (const note of chart.notes) {
    end = Math.max(end, ticksToMilliseconds(note.tick, chart.bpm) + rules.hitWindow.lateMs,
      ticksToMilliseconds(note.tick + note.durationTicks, chart.bpm));
  }
  return end;
}

/** O relógio/adaptador da plataforma será fornecido nas etapas 04–05. */
export interface MonotonicClock {
  nowMs(): Milliseconds;
}
