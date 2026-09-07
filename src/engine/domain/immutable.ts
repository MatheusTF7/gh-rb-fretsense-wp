import { requireCondition } from './validation';

/** Copia dados simples, sem aliases mutáveis, getters, ciclos ou dependência de structuredClone. */
export function immutableCopy<T>(value: T): T {
  const ancestors = new Set<object>();
  let nodes = 0;

  function copy(item: unknown, depth: number): unknown {
    nodes += 1;
    requireCondition(depth <= 16 && nodes <= 200_000, 'snapshot', 'Snapshot exceeds its limits.', 'resource-limit');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number') {
      requireCondition(Number.isFinite(item), 'snapshot', 'Non-finite number.', 'invalid-type');
      return item;
    }
    requireCondition(typeof item === 'object', 'snapshot', 'Only serializable data is accepted.', 'invalid-type');
    requireCondition(!ancestors.has(item), 'snapshot', 'Cyclic data is not accepted.', 'invalid-type');
    requireCondition(Array.isArray(item) || Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null,
      'snapshot', 'Only arrays and plain objects are accepted.', 'invalid-type');
    requireCondition(Object.getOwnPropertySymbols(item).length === 0, 'snapshot', 'Symbol properties are not serializable.', 'invalid-type');
    ancestors.add(item);
    if (Array.isArray(item)) {
      requireCondition(item.length <= 131_072, 'snapshot', 'Array exceeds its limit.', 'resource-limit');
    }
    const entries = Object.entries(Object.getOwnPropertyDescriptors(item));
    const result: unknown[] | Record<string, unknown> = Array.isArray(item) ? [] : {};
    for (const [key, descriptor] of entries) {
      if (Array.isArray(item) && key === 'length') continue;
      requireCondition('value' in descriptor, 'snapshot', 'Accessors are not accepted.', 'invalid-type');
      Object.defineProperty(result, key, {
        value: copy(descriptor.value, depth + 1),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    if (Array.isArray(item) && Array.isArray(result)) result.length = item.length;
    ancestors.delete(item);
    return Object.freeze(result);
  }

  return copy(value, 0) as T;
}
