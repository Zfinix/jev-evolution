import { readdir } from "node:fs/promises";
import { ENVIRONMENTS } from "../src/environments";
import type { Run } from "../src/evolve";
import { jevFromEnv } from "./jev-env";
import { judgeLives } from "../src/life";

const name = process.argv[2] ?? (await readdir("runs")).filter((file) => file.endsWith(".json")).sort().at(-1);
if (!name) throw new Error("No run to chronicle. Run `bun run evolve` first.");
const path = name.startsWith("runs/") ? name : `runs/${name}`;

const run: Run = await Bun.file(path).json();
const jev = jevFromEnv();
const started = performance.now();

for (const generation of run.generations) {
  const pending = generation.creatures.filter((creature) => !creature.life);
  if (pending.length === 0) continue;
  const lives = await judgeLives(jev, ENVIRONMENTS[generation.environment], pending);
  for (const creature of pending) creature.life = lives.get(creature.id);
  const deaths = pending.filter((creature) => !creature.alive).map((creature) => creature.life!.cause.choice);
  const counts = new Map<string, number>();
  for (const cause of deaths) counts.set(cause, (counts.get(cause) ?? 0) + 1);
  const tally = [...counts].map(([cause, count]) => `${cause} ${count}`).join(", ");
  console.log(`G${String(generation.index).padStart(2)}  ${pending.length} lives  deaths: ${tally || "none"}`);
  await Bun.write(path, JSON.stringify(run, null, 2));
}

const seconds = (performance.now() - started) / 1000;
console.log(`\n${jev.usage.calls} Jev calls in ${seconds.toFixed(1)}s, ${jev.usage.inputTokens} input tokens`);
console.log(`updated ${path}`);
