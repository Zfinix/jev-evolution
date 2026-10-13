export type Rng = {
  next(): number;
  pick<T>(items: T[]): T;
  // Seeding a new generator with this value resumes the sequence exactly.
  state(): number;
};

export function seeded(seed: number): Rng {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    pick: (items) => items[Math.floor(next() * items.length)],
    state: () => state,
  };
}
