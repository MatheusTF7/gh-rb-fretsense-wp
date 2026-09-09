import { immutableCopy } from '../domain/immutable';
import { ENGINE_LIMITS } from '../domain/limits';
import { readInteger, requireCondition } from '../domain/validation';

/** Nunca sobrescreve silenciosamente registros de uma tentativa. */
export class BoundedBuffer<T> {
  private readonly items: T[] = [];

  constructor(readonly capacity: number) {
    readInteger(capacity, 'buffer.capacity', 1, ENGINE_LIMITS.maximumJudgmentEvents);
  }

  get size(): number { return this.items.length; }

  append(item: T): void {
    requireCondition(this.items.length < this.capacity, 'buffer.capacity', 'Buffer capacity reached.', 'resource-limit');
    this.items.push(immutableCopy(item));
  }

  snapshot(): readonly T[] { return Object.freeze([...this.items]); }

  /** Copia somente o sufixo ainda não consumido por observadores incrementais. */
  snapshotFrom(start: number): readonly T[] {
    readInteger(start, 'buffer.start', 0, this.items.length);
    return Object.freeze(this.items.slice(start));
  }
}
