import { evolve, type Config } from "../src/evolve";
import { jevFromEnv } from "./jev-env";
import { seeded } from "../src/rng";

const config: Config = {
  seed: Number(process.env.SEED ?? Date.now() % 100_000),
  foundersPerPool: 12,
  populationCap: 40,
  generations: Number(process.env.GENERATIONS ?? 14),
  mutationRate: 0.06,
  offspringPerPair: 4,
  mateCandidates: 3,
  minBreeders: 3,
  schedule: { 0: "tidepools", 5: "iceAge", 10: "deepOcean" },
};

const jev = jevFromEnv();
const started = performance.now();
const run = await evolve(config, jev, seeded(config.seed), (generation) => {
  const alive = generation.creatures.filter((c) => c.alive);
  const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  console.log(
    [
      `gen ${String(generation.index).padStart(2)}`,
      generation.environment.padEnd(10),
      `born ${String(generation.creatures.length).padStart(2)}`,
      `survived ${String(alive.length).padStart(2)}`,
      `avg score ${avg(generation.creatures.map((c) => c.survival.score)).toFixed(2)}`,
      `vent share ${avg(alive.map((c) => c.ventShare)).toFixed(2)}`,
    ].join("  "),
  );
});

const path = `runs/${new Date().toISOString().replace(/[:.]/g, "-")}-seed${config.seed}.json`;
await Bun.write(path, JSON.stringify(run, null, 2));
const seconds = (performance.now() - started) / 1000;
console.log(`\n${run.usage.calls} Jev calls in ${seconds.toFixed(1)}s, ${run.usage.inputTokens} input tokens`);
console.log(`saved ${path}`);
