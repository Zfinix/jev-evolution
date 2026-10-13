import { crossover, mutate, type Creature } from "../src/genome";
import { ENVIRONMENTS } from "../src/environments";
import { judgeSurvival } from "../src/judge";
import { seeded } from "../src/rng";
import { DESERT_DNA, VENT_DNA } from "../src/traits";
import { jevFromEnv } from "./jev-env";

const rng = seeded(7);
const jev = jevFromEnv();

const creatures: Creature[] = [];
for (let i = 0; i < 3; i++) {
  const vent = mutate(VENT_DNA, 0.1, rng);
  creatures.push({ id: `v${i}`, generation: 0, parents: [], dna: vent.dna, ventShare: 1, mutations: vent.mutations });
  const desert = mutate(DESERT_DNA, 0.1, rng);
  creatures.push({ id: `d${i}`, generation: 0, parents: [], dna: desert.dna, ventShare: 0, mutations: desert.mutations });
}
for (let i = 0; i < 2; i++) {
  creatures.push({ id: `h${i}`, generation: 1, parents: [], dna: crossover(VENT_DNA, DESERT_DNA, rng), ventShare: 0.5, mutations: [] });
}

const environments = Object.values(ENVIRONMENTS);
const scores = new Map<string, Map<string, number>>();
await Promise.all(
  environments.map(async (environment) => {
    const result = await judgeSurvival(jev, environment, creatures);
    scores.set(environment.id, new Map([...result].map(([id, survival]) => [id, survival.score])));
  }),
);
const repeat = await judgeSurvival(jev, ENVIRONMENTS.tidepools, creatures);

const mean = (env: string, prefix: string) => {
  const values = creatures.filter((c) => c.id.startsWith(prefix)).map((c) => scores.get(env)!.get(c.id)!);
  return values.reduce((a, b) => a + b, 0) / values.length;
};

console.log("\nSurvival score, 0 dies within a season .. 3 thrives\n");
console.log(["creature".padEnd(10), ...environments.map((e) => e.id.padStart(11))].join(""));
for (const creature of creatures) {
  const row = environments.map((e) => scores.get(e.id)!.get(creature.id)!.toFixed(2).padStart(11));
  console.log([creature.id.padEnd(10), ...row].join(""));
}
console.log("");
for (const [label, prefix] of [["vent mean", "v"], ["desert mean", "d"], ["hybrid mean", "h"]]) {
  console.log([label.padEnd(10), ...environments.map((e) => mean(e.id, prefix).toFixed(2).padStart(11))].join(""));
}

const drift = Math.max(
  ...creatures.map((c) => Math.abs(repeat.get(c.id)!.score - scores.get("tidepools")!.get(c.id)!)),
);
const ventSwing = mean("deepOcean", "v") - mean("desert", "v");
const desertSwing = mean("desert", "d") - mean("deepOcean", "d");
const passed = ventSwing > 1.5 && desertSwing > 1.5 && drift < 0.5;

console.log(`\nvent swing (deep ocean minus desert):   ${ventSwing.toFixed(2)}`);
console.log(`desert swing (desert minus deep ocean): ${desertSwing.toFixed(2)}`);
console.log(`largest drift on a repeated call:       ${drift.toFixed(2)}`);
console.log(
  `\n${jev.usage.calls} calls, ${jev.usage.inputTokens} input tokens, ${(jev.usage.millis / jev.usage.calls).toFixed(0)}ms per call`,
);
console.log(passed ? "\nPASS: selection pressure follows the environment" : "\nFAIL: scores do not track the environment");
process.exit(passed ? 0 : 1);
