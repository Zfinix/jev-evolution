import { TRAITS, type Dna } from "./traits";
import type { Rng } from "./rng";

export type Creature = {
  id: string;
  generation: number;
  parents: string[];
  dna: Dna;
  // Share of the vent founders' genes, 1 for pure vent and 0 for pure desert.
  ventShare: number;
  mutations: string[];
};

export function mutate(dna: Dna, rate: number, rng: Rng): { dna: Dna; mutations: string[] } {
  const next = { ...dna };
  const mutations: string[] = [];
  for (const trait of TRAITS) {
    if (rng.next() >= rate) continue;
    const others = trait.options.filter((option) => option !== next[trait.name]);
    next[trait.name] = rng.pick(others);
    mutations.push(trait.name);
  }
  return { dna: next, mutations };
}

export function crossover(a: Dna, b: Dna, rng: Rng): Dna {
  const child: Dna = {};
  for (const trait of TRAITS) {
    child[trait.name] = rng.next() < 0.5 ? a[trait.name] : b[trait.name];
  }
  return child;
}

export function describe(creature: Creature): string {
  const traits = TRAITS.map((trait) => `${trait.name}: ${creature.dna[trait.name]}`).join("; ");
  return `${creature.id}: ${traits}`;
}
