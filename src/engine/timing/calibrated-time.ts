import type { CalibrationProfile } from '../domain/input';

/** O julgador usa esta conversão uma vez por entrada e por avanço do horizonte. */
export function judgmentTime(rawMs: number, calibration: Pick<CalibrationProfile, 'judgmentOffsetMs'>): number {
  return rawMs - calibration.judgmentOffsetMs;
}

/** Conversão exclusiva da imagem: não modifica música, entrada ou julgamento. */
export function visualTime(rawMs: number, calibration: Pick<CalibrationProfile, 'visualOffsetMs'>): number {
  return rawMs - calibration.visualOffsetMs;
}
