import { DESERT_DNA, VENT_DNA } from "../src/traits";
import { el, metrics, section, specimen } from "./dom";
import { genome } from "./genome";
import { createHelix } from "./helix";
import type { InspectorContext } from "./inspector";
import { CAUSE_TEXT } from "./story";
import { colors } from "./theme";

export function renderOverview(context: InspectorContext): HTMLElement[] {
  const { run } = context;
  const creatures = run.generations.flatMap((generation) => generation.creatures);
  const decisions = creatures.length + creatures.filter((creature) => creature.mate).length;
  const final = run.generations[run.generations.length - 1];

  const intro = el("header", "inspector-header");
  intro.append(
    el("h2", undefined, run.world ? "The living world" : "Founding populations"),
    el(
      "p",
      "lede",
      run.world
        ? `Anyone can move this world forward, up to ${run.world.cap} generations. Pick what happens next in the bar below. Jev judges every organism's survival and chooses every mate.`
        : "Two populations with opposite DNA seeded this world. Jev judged every organism's survival and chose every mate.",
    ),
  );

  const hint = el("p", "hint", "Click an organism to inspect it. Shift-click a second one to compare them.");

  const founder = (title: string, dna: Record<string, string>, accent: string) => {
    const card = el("div", "founder");
    const heading = el("div", "founder-title", title);
    heading.style.color = accent;
    card.append(heading, specimen(dna, title, 120), createHelix({ loci: genome(dna), accent, height: 70 }));
    return card;
  };

  const eras = el("ol", "eras");
  let start = 0;
  run.generations.forEach((generation, i) => {
    const next = run.generations[i + 1];
    if (next && next.environment === generation.environment) return;
    const item = el("li");
    const swatch = el("span", "era-swatch");
    swatch.style.background = colors().inks[generation.environment] ?? "#737373";
    item.append(
      swatch,
      el("span", undefined, run.environments[generation.environment]?.name ?? generation.environment),
      el("span", "muted", start === i ? `G${i}` : `G${start} to G${i}`),
    );
    eras.append(item);
    start = i + 1;
  });

  const causes = new Map<string, number>();
  for (const creature of creatures) {
    if (!creature.alive && creature.life) causes.set(creature.life.cause.choice, (causes.get(creature.life.cause.choice) ?? 0) + 1);
  }
  const deaths = [...causes.values()].reduce((sum, count) => sum + count, 0);
  const causeRows = el("div", "bars");
  for (const [cause, count] of [...causes].sort((x, y) => y[1] - x[1])) {
    const row = el("div", "bar-row cause-row");
    const track = el("div", "bar-track");
    const fill = el("div", "bar-fill chosen");
    fill.style.width = `${(count / deaths) * 100}%`;
    track.append(fill);
    const label = CAUSE_TEXT[cause] ?? cause;
    row.append(el("span", undefined, label.charAt(0).toUpperCase() + label.slice(1)), track, el("span", "mono", String(count)));
    causeRows.append(row);
  }

  return [
    intro,
    hint,
    section(
      "Run",
      metrics([
        ["Organisms", creatures.length.toLocaleString()],
        run.world ? ["Generations", `${run.world.generations} / ${run.world.cap}`] : ["Generations", String(run.generations.length)],
        [run.world ? "Alive now" : "Alive at end", `${final.creatures.filter((c) => c.alive).length}`],
        ["Jev decisions", decisions.toLocaleString()],
        ["Jev calls", run.usage.calls.toLocaleString()],
        ["Avg call", `${Math.round(run.usage.millis / Math.max(1, run.usage.calls))} ms`],
      ]),
    ),
    section("Environments", eras),
    ...(deaths ? [section(`Causes of death · ${deaths} deaths`, causeRows)] : []),
    section("Founder genomes", founder("Hydrothermal vent", VENT_DNA, "#0891b2"), founder("Desert cliff", DESERT_DNA, "#ea580c")),
  ];
}
