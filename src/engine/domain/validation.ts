import type { NoteFrets, VersionedReference } from './music';
import { ENGINE_LIMITS } from './limits';

export type EngineErrorCode =
  | 'invalid-type'
  | 'out-of-range'
  | 'unsupported'
  | 'incompatible'
  | 'invalid-transition'
  | 'invalid-clock'
  | 'resource-limit';

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

export function requireCondition(
  condition: unknown,
  path: string,
  message: string,
  code: EngineErrorCode = 'incompatible',
): asserts condition {
  if (!condition) throw new EngineError(code, path, message);
}

export function readRecord(value: unknown, path: string): Record<string, unknown> {
  requireCondition(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    path,
    'Expected an object.',
    'invalid-type',
  );
  return value as Record<string, unknown>;
}

export function readNumber(value: unknown, path: string, min: number, max: number): number {
  requireCondition(typeof value === 'number' && Number.isFinite(value), path, 'Expected a finite number.', 'invalid-type');
  requireCondition(value >= min && value <= max, path, `Expected a value in [${min}, ${max}].`, 'out-of-range');
  return value;
}

export function readInteger(value: unknown, path: string, min: number, max: number): number {
  const number = readNumber(value, path, min, max);
  requireCondition(Number.isSafeInteger(number), path, 'Expected a safe integer.', 'invalid-type');
  return number;
}

export function readString(value: unknown, path: string, max: number = ENGINE_LIMITS.maximumTextLength): string {
  requireCondition(typeof value === 'string', path, 'Expected a string.', 'invalid-type');
  requireCondition(value.trim().length > 0 && value.length <= max, path, 'String is empty or too long.', 'out-of-range');
  return value;
}

export function readBoolean(value: unknown, path: string): boolean {
  requireCondition(typeof value === 'boolean', path, 'Expected a boolean.', 'invalid-type');
  return value;
}

export function readChoice<const T extends readonly (string | number)[]>(
  value: unknown,
  choices: T,
  path: string,
): T[number] {
  requireCondition(choices.some((choice) => choice === value), path, 'Unsupported value.', 'unsupported');
  return value as T[number];
}

export function readArray(value: unknown, path: string, max: number): unknown[] {
  requireCondition(Array.isArray(value), path, 'Expected an array.', 'invalid-type');
  requireCondition(value.length <= max, path, 'Array exceeds its limit.', 'resource-limit');
  for (let index = 0; index < value.length; index += 1) {
    requireCondition(Object.hasOwn(value, index), path, 'Sparse arrays are not accepted.', 'invalid-type');
  }
  return value as unknown[];
}

/** Compara dados com uma referência canônica sem depender da ordem de chaves do JSON. */
export function requireSameData(value: unknown, expected: unknown, path: string): void {
  if (expected === null || typeof expected !== 'object') {
    requireCondition(value === expected, path, 'Data differs from its versioned definition.');
    return;
  }
  if (Array.isArray(expected)) {
    const array = readArray(value, path, expected.length);
    requireCondition(array.length === expected.length, path, 'Array length differs.');
    expected.forEach((entry: unknown, index: number) => requireSameData(array[index], entry, `${path}[${index}]`));
    return;
  }
  const record = readRecord(value, path);
  const entries = Object.entries(expected);
  requireCondition(Object.keys(record).length === entries.length, path, 'Unexpected object fields.');
  for (const [key, entry] of entries) requireSameData(record[key], entry, `${path}.${key}`);
}

export function readReference(value: unknown, path: string): VersionedReference {
  const record = readRecord(value, path);
  return { id: readString(record.id, `${path}.id`), version: readString(record.version, `${path}.version`) };
}

export function sameReference(left: VersionedReference, right: VersionedReference): boolean {
  return left.id === right.id && left.version === right.version;
}

export function readNoteFrets(value: unknown, path: string): NoteFrets {
  return readInteger(value, path, 1, 31) as NoteFrets;
}

export function countFrets(mask: number): number {
  readInteger(mask, 'frets', 0, 31);
  let count = 0;
  for (let bits = mask; bits !== 0; bits &= bits - 1) count += 1;
  return count;
}

export function readIsoDate(value: unknown, path: string): string {
  const text = readString(value, path);
  requireCondition(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text), path, 'Expected a UTC ISO date with milliseconds.');
  const date = new Date(text);
  requireCondition(Number.isFinite(date.getTime()) && date.toISOString() === text, path, 'Invalid calendar date.');
  return text;
}
