import { readInteger, readString } from '../domain/validation';

/** Hash FNV-1a sobre unidades UTF-16; faz parte de initial-generator@1.0.0. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
}

/** PRNG inteiro com estado local; não usa Math.random nem relógio. */
export function createSeededRandom(seed: string) {
  readString(seed, 'seed');
  let state = hashSeed(seed);
  return {
    nextIndex(size: number): number {
      readInteger(size, 'random.size', 1, 4096);
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return Math.floor((state / 0x1_0000_0000) * size);
    },
  };
}
