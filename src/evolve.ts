import { crossover, mutate, type Creature } from "./genome";
import { ENVIRONMENTS, type Environment } from "./environments";
import type { Jev } from "./jev";
import { chooseMates, judgeSurvival, type Survival } from "./judge";
import { judgeLives, type Life } from "./life";
import type { Rng } from "./rng";
import { DESERT_DNA, VENT_DNA, type Dna } from "./traits";

export type Config = {
  seed: number;
  foundersPerPool: number;
  populationCap: number;
  generations: number;
  mutationRate: number;
  offspringPerPair: number;
  mateCandidates: number;
  // When fewer creatures survive, the likeliest ones are spared so the line goes on.
  minBreeders: number;
  // Generation index to environment id; the world switches when a key is reached.
  schedule: Record<number, string>;
};

export type Individual = Creature & {
  alive: boolean;
  spared?: boolean;
  survival: Survival;
  life?: Life;
  mate?: { id: string; probabilities: Record<string, number> };
};

export type Generation = { index: number; environment: string; creatures: Individual[] };

export type Run = {
  config: Config;
  environments: Record<string, Environment>;
  generations: Generation[];
  usage: Jev["usage"];
};

export type Ids = { next: number };

export function founders(config: Config, rng: Rng, ids: Ids): Creature[] {
  const pool = (dna: Dna, ventShare: number): Creature[] =>
    Array.from({ length: config.foundersPerPool }, () => {
      const mutated = mutate(dna, config.mutationRate * 2, rng);
      return { id: `c${ids.next++}`, generation: 0, parents: [], dna: mutated.dna, ventShare, mutations: mutated.mutations };
    });
  return [...pool(VENT_DNA, 1), ...pool(DESERT_DNA, 0)];
}

export async function judgeGeneration(
  config: Config,
  jev: Jev,
  rng: Rng,
  index: number,
  environment: Environment,
  population: Creature[],
): Promise<Generation> {
  const [survival, lives] = await Promise.all([
    judgeSurvival(jev, environment, population),
    judgeLives(jev, environment, population),
  ]);
  const records: Individual[] = population.map((creature) => ({
    ...creature,
    survival: survival.get(creature.id)!,
    life: lives.get(creature.id),
    alive: rng.next() < survival.get(creature.id)!.chance,
  }));
  const spare = [...records]
    .filter((record) => !record.alive)
    .sort((a, b) => b.survival.chance - a.survival.chance)
    .slice(0, Math.max(0, config.minBreeders - records.filter((record) => record.alive).length));
  for (const record of spare) {
    record.alive = true;
    record.spared = true;
  }
  const survivors = records.filter((record) => record.alive);

  const mates = await chooseMates(jev, environment, survivors, config.mateCandidates, rng.pick);
  for (const record of records) {
    const mate = mates.get(record.id);
    if (mate) record.mate = { id: mate.mate, probabilities: mate.probabilities };
  }
  return { index, environment: environment.id, creatures: records };
}

export function breed(config: Config, rng: Rng, generation: Generation, ids: Ids): Creature[] {
  const survivors = generation.creatures.filter((creature) => creature.alive);
  const byId = new Map(survivors.map((survivor) => [survivor.id, survivor]));
  const children: Creature[] = [];
  for (const parent of [...survivors].sort((a, b) => b.survival.chance - a.survival.chance)) {
    const partner = parent.mate && byId.get(parent.mate.id);
    if (!partner) continue;
    for (let n = 0; n < config.offspringPerPair && children.length < config.populationCap; n++) {
      const mutated = mutate(crossover(parent.dna, partner.dna, rng), config.mutationRate, rng);
      children.push({
        id: `c${ids.next++}`,
        generation: generation.index + 1,
        parents: [parent.id, partner.id],
        dna: mutated.dna,
        ventShare: (parent.ventShare + partner.ventShare) / 2,
        mutations: mutated.mutations,
      });
    }
  }
  return children;
}

export async function evolve(
  config: Config,
  jev: Jev,
  rng: Rng,
  onGeneration: (generation: Generation) => void,
): Promise<Run> {
  const ids: Ids = { next: 0 };
  let population = founders(config, rng, ids);
  let environment = ENVIRONMENTS[config.schedule[0]];
  const generations: Generation[] = [];

  for (let index = 0; index < config.generations && population.length > 0; index++) {
    if (config.schedule[index]) environment = ENVIRONMENTS[config.schedule[index]];
    const generation = await judgeGeneration(config, jev, rng, index, environment, population);
    generations.push(generation);
    onGeneration(generation);
    population = breed(config, rng, generation, ids);
  }

  return { config, environments: ENVIRONMENTS, generations, usage: jev.usage };
}
