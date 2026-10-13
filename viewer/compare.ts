import { SLOT_COLORS } from "./color";
import { button, el, iconButton, idLink, metrics, section, sequence, specimen } from "./dom";
import { genome, sequenceIdentity } from "./genome";
import { createHelix } from "./helix";
import type { InspectorContext } from "./inspector";
import { relate } from "./relations";
import { lifeStory } from "./story";

export function renderCompare(context: InspectorContext, a: string, b: string): HTMLElement[] {
  const { run, layout } = context;
  const first = layout.byId.get(a)!;
  const second = layout.byId.get(b)!;
  const relation = relate(layout, a, b);
  const lociA = genome(first.creature.dna);
  const lociB = genome(second.creature.dna);
  const mismatched = new Set(lociA.flatMap((locus, i) => (locus.value === lociB[i].value ? [] : [i])));
  const sharedAlleles = lociA.length - mismatched.size;

  const header = el("header", "inspector-header");
  const title = el("div", "title-row");
  title.append(el("h2", undefined, "Comparison"), button("Swap", () => context.swap(), "btn"));
  header.append(title);

  const card = (slot: "a" | "b") => {
    const node = slot === "a" ? first : second;
    const { creature } = node;
    const wrapper = el("div", "compare-card");
    wrapper.style.setProperty("--slot", SLOT_COLORS[slot]);
    const top = el("div", "compare-card-top");
    const chip = el("span", "slot-chip", slot.toUpperCase());
    chip.style.background = SLOT_COLORS[slot];
    top.append(chip, idLink(creature.id, (id) => context.select(id, "a")), iconButton("close", `Remove ${slot.toUpperCase()}`, () => context.clear(slot)));
    const environment = run.environments[node.environment]?.name ?? node.environment;
    wrapper.append(
      top,
      specimen(creature.dna, creature.id, 120),
      el("div", "muted small", `G${creature.generation} · ${environment}`),
      el("div", "small", `Score ${creature.survival.score.toFixed(2)}`),
      el("div", "small card-headline", lifeStory(run, layout, creature.id).headline),
    );
    return wrapper;
  };
  const cards = el("div", "compare-cards");
  cards.append(card("a"), card("b"));

  const callout = el("div", "relation");
  callout.append(el("div", "relation-label", relation.label));
  const detail = el("div", "relation-detail");
  if (relation.mrca) {
    const others = relation.sharedAncestors.length > 1 ? ` and ${relation.sharedAncestors.length - 1} more at that generation` : "";
    detail.append(
      "Most recent common ancestor ",
      idLink(relation.mrca, (id) => context.select(id, "a")),
      ` (G${layout.byId.get(relation.mrca)!.creature.generation})${others}. `,
      `${relation.stepsA} generation${relation.stepsA === 1 ? "" : "s"} above A, ${relation.stepsB} above B.`,
    );
  } else {
    detail.append("No shared ancestor in this run.");
  }
  callout.append(detail);

  const blocks: HTMLElement[] = [
    header,
    cards,
    callout,
    section(
      "Similarity",
      metrics([
        ["Relatedness", `${(relation.relatedness * 100).toFixed(1)}%`],
        ["Shared alleles", `${sharedAlleles} / ${lociA.length}`],
        ["Sequence identity", `${(sequenceIdentity(lociA, lociB) * 100).toFixed(1)}%`],
        ["Generations apart", String(Math.abs(first.creature.generation - second.creature.generation))],
        ["Score A", first.creature.survival.score.toFixed(2)],
        ["Score B", second.creature.survival.score.toFixed(2)],
      ]),
    ),
  ];

  const mateNotes: string[] = [];
  const considered = (from: typeof first, to: string) => {
    const probability = from.creature.mate?.probabilities[to];
    if (probability === undefined) return;
    const chosen = from.creature.mate!.id === to ? "and chose them" : "but chose someone else";
    mateNotes.push(`Jev gave ${from.creature.id} a ${Math.round(probability * 100)}% pull toward ${to} as a mate, ${chosen}.`);
  };
  considered(first, b);
  considered(second, a);
  if (mateNotes.length) blocks.push(section("Mate history", ...mateNotes.map((note) => el("p", "note", note))));

  const actions = el("div", "actions");
  actions.append(
    button("Show both in tree", () => context.zoomTo([a, b, ...(relation.mrca ? [relation.mrca] : [])]), "btn primary"),
  );
  blocks.push(
    actions,
    section(
      "Genomes",
      el("div", "helix-label a", `A · ${a}`),
      createHelix({ loci: lociA, accent: SLOT_COLORS.a, mismatched, height: 80 }),
      el("div", "helix-label b", `B · ${b}`),
      createHelix({ loci: lociB, accent: SLOT_COLORS.b, mismatched, height: 80 }),
    ),
  );

  const table = el("table", "loci alignment");
  const head = el("tr");
  for (const label of ["#", "Gene", "Sequences", "Alleles"]) head.append(el("th", undefined, label));
  table.append(head);
  lociA.forEach((locus, i) => {
    const other = lociB[i];
    const row = el("tr", mismatched.has(i) ? "differs" : undefined);
    const sequences = el("td");
    const lineA = el("div", "aligned");
    lineA.append(el("b", "slot-a", "A"), sequence(locus.sequence));
    const lineB = el("div", "aligned");
    lineB.append(el("b", "slot-b", "B"), sequence(other.sequence, locus.sequence));
    sequences.append(lineA, lineB);
    const alleles = el("td");
    alleles.append(el("div", undefined, locus.value), el("div", mismatched.has(i) ? "changed" : "muted", other.value));
    row.append(el("td", "muted mono", String(i + 1)), el("td", undefined, locus.trait), sequences, alleles);
    table.append(row);
  });
  blocks.push(section("Alignment", table));
  return blocks;
}
