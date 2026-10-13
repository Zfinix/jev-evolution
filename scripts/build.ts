import { mkdir, readdir, rm } from "node:fs/promises";

const OUT = "dist";

await rm(OUT, { recursive: true, force: true });
const result = await Bun.build({ entrypoints: ["viewer/index.html"], outdir: OUT, minify: true });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// Only runs with Jev's life stories are worth showing.
await mkdir(`${OUT}/runs`, { recursive: true });
const published: string[] = [];
for (const name of (await readdir("runs")).filter((file) => file.endsWith(".json")).sort().reverse()) {
  const run = await Bun.file(`runs/${name}`).json();
  const chronicled = run.generations.some((generation: { creatures: { life?: unknown }[] }) =>
    generation.creatures.some((creature) => creature.life),
  );
  if (!chronicled) continue;
  await Bun.write(`${OUT}/runs/${name}`, JSON.stringify(run));
  published.push(name);
}
await Bun.write(`${OUT}/runs/index.json`, JSON.stringify(published));

console.log(`built ${OUT} with ${published.length} run${published.length === 1 ? "" : "s"}: ${published.join(", ")}`);
