import { lineageRgb, rgba, SLOT_COLORS } from "./color";
import { button, el, iconButton, idLink, metrics, pill, section, sequence, specimen } from "./dom";
import { alleleOrigin, genome, ORIGINS } from "./genome";
import { createHelix } from "./helix";
import type { InspectorContext } from "./inspector";
import { descendantCount } from "./layout";
import { lifeStory } from "./story";

const OUTCOMES = [
  { label: "Dies", color: "#e11d48" },
  { label: "Struggles", color: "#f59e0b" },
  { label: "Survives", color: "#10b981" },
  { label: "Thrives", color: "#047857" },
];

export function renderOrganism(context: InspectorContext, id: string): HTMLElement[] {
  const { run, layout } = context;
  const node = layout.byId.get(id)!;
  const { creature } = node;
  const loci = genome(creature.dna);
  const pick = (target: string) => context.select(target, "a");
  const link = (target: string) => (layout.byId.has(target) ? idLink(target, pick) : el("span", "mono muted", target));

  const header = el("header", "inspector-header");
  const title = el("div", "title-row");
  const chip = el("span", "slot-chip", "A");
  chip.style.background = SLOT_COLORS.a;
  const status = creature.spared
    ? pill("Spared, last of its kind", "warn")
    : creature.alive
      ? pill("Survived", "good")
      : pill("Died", "bad");
  title.append(chip, el("h2", undefined, creature.id), status, iconButton("close", "Close", () => context.clear("a")));
  const environment = run.environments[node.environment]?.name ?? node.environment;
  header.append(title, el("p", "lede", `Generation ${creature.generation} · ${environment}`));

  const actions = el("div", "actions");
  actions.append(
    button(context.picking ? "Click an organism in the tree…" : "Compare with…", () => context.pickSecond(), "btn primary"),
    button("Show in tree", () => context.zoomTo([id])),
  );

  const share = Math.round(creature.ventShare * 100);
  const ancestryText = share === 100 ? "100% vent" : share === 0 ? "100% desert" : `${share}% vent`;
  const ancestry = el("span", undefined, ancestryText);
  ancestry.style.color = rgba(lineageRgb(creature.ventShare), 1);

  const facts = metrics([
    ["Ancestry", ancestry],
    ["Offspring", String(node.offspring.length)],
    ["Descendants", String(descendantCount(layout, id))],
    ["Survival score", `${creature.survival.score.toFixed(2)} / 3`],
    ["Chance to live", `${Math.round(creature.survival.chance * 100)}%`],
    ["Lineage", node.lineageSurvives ? "Extant" : "Extinct"],
  ]);

  const odds = el("div", "odds");
  const oddsLegend = el("div", "odds-legend");
  OUTCOMES.forEach((outcome, i) => {
    const probability = creature.survival.probabilities[String(i)] ?? 0;
    const segment = el("div");
    segment.style.flex = String(Math.max(probability, 0.0001));
    segment.style.background = outcome.color;
    odds.append(segment);
    const label = el("span");
    const dot = el("i");
    dot.style.background = outcome.color;
    label.append(dot, `${outcome.label} ${Math.round(probability * 100)}%`);
    oddsLegend.append(label);
  });

  const parents = el("div", "parents");
  if (creature.parents.length) {
    parents.append(link(creature.parents[0]), el("span", "muted", " × "), link(creature.parents[1]));
  } else {
    parents.append(el("span", "muted", `Founder of the ${creature.ventShare === 1 ? "vent" : "desert"} population`));
  }

  const story = lifeStory(run, layout, id);
  const timeline = el("ol", "life");
  for (const event of story.events) {
    const item = el("li", `life-event ${event.kind}`);
    const body = el("p");
    for (const part of event.body) body.append(typeof part === "string" ? part : link(part.id));
    item.append(el("div", "life-title", event.title), body);
    timeline.append(item);
  }
  if (!creature.life) {
    timeline.append(el("li", "life-missing", "Run `bun run chronicle` to add Jev's cause of death, strengths and weaknesses."));
  }

  const blocks: HTMLElement[] = [
    header,
    specimen(creature.dna, creature.id, 170),
    actions,
    section("Life story", el("p", "headline", story.headline), timeline),
    section("Profile", facts),
    section("Genome", createHelix({ loci, accent: SLOT_COLORS.a })),
    section("Jev survival assessment", odds, oddsLegend),
    section("Parents", parents),
  ];

  if (creature.mate) {
    const rows = el("div", "bars");
    for (const [candidate, probability] of Object.entries(creature.mate.probabilities).sort((x, y) => y[1] - x[1])) {
      const row = el("div", "bar-row");
      const track = el("div", "bar-track");
      const fill = el("div", candidate === creature.mate.id ? "bar-fill chosen" : "bar-fill");
      fill.style.width = `${Math.max(1, probability * 100)}%`;
      track.append(fill);
      row.append(
        idLink(candidate, pick),
        track,
        el("span", "mono", `${Math.round(probability * 100)}%`),
        button("Compare", () => context.select(candidate, "b"), "mini-btn"),
      );
      rows.append(row);
    }
    blocks.push(section("Jev mate selection", rows));
  }

  const table = el("table", "loci");
  const head = el("tr");
  for (const label of ["#", "Gene", "Allele", "Sequence"]) head.append(el("th", undefined, label));
  table.append(head);
  loci.forEach((locus, i) => {
    const origin = ORIGINS[alleleOrigin(creature, locus.trait)];
    const row = el("tr");
    const allele = el("td");
    const dot = el("i", "origin-dot");
    dot.style.background = origin.color;
    dot.title = origin.label;
    allele.append(dot, locus.value);
    const sequenceCell = el("td");
    sequenceCell.append(sequence(locus.sequence));
    row.append(el("td", "muted mono", String(i + 1)), el("td", undefined, locus.trait), allele, sequenceCell);
    table.append(row);
  });
  const legend = el("div", "origin-legend");
  for (const origin of Object.values(ORIGINS)) {
    const item = el("span");
    const dot = el("i", "origin-dot");
    dot.style.background = origin.color;
    item.append(dot, origin.label);
    legend.append(item);
  }
  blocks.push(section("Loci", table, legend));
  return blocks;
}
