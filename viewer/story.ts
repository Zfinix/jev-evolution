import { descendantCount, type Layout } from "./layout";
import type { Run } from "./types";

export type Segment = string | { id: string };

export type LifeEvent = {
  kind: "birth" | "genes" | "assessment" | "death" | "survival" | "spared" | "mating" | "offspring" | "legacy";
  title: string;
  body: Segment[];
};

export type Story = { headline: string; events: LifeEvent[] };

export const CAUSE_TEXT: Record<string, string> = {
  cold: "the cold",
  heat: "overheating",
  thirst: "thirst",
  starvation: "starvation",
  predators: "predators",
  habitat: "a habitat it could not live in",
  frailty: "weakness",
};

const TRAIT_NOUNS: Record<string, string> = {
  covering: "covering",
  size: "size",
  metabolism: "metabolism",
  temperature: "temperature tolerance",
  water: "water needs",
  light: "light habits",
  locomotion: "way of moving",
  speed: "speed",
  diet: "diet",
  social: "social life",
  senses: "senses",
  defense: "defense",
  reproduction: "breeding strategy",
  lifespan: "lifespan",
  limbs: "limbs",
  intelligence: "intelligence",
};

const OUTCOMES = ["die within a season", "struggle", "survive", "thrive"];

const pct = (value: number) => `${Math.round(value * 100)}%`;
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
const trait = (creature: { dna: Record<string, string> }, name: string) => `${TRAIT_NOUNS[name] ?? name} (${creature.dna[name]})`;

function list(ids: string[]): Segment[] {
  return ids.flatMap((id, i) => [
    ...(i === 0 ? [] : [i === ids.length - 1 ? " and " : ", "]),
    { id },
  ]);
}

function bloodline(layout: Layout, id: string, lastGeneration: number) {
  const seen = new Set<string>();
  const stack = [...(layout.byId.get(id)?.offspring ?? [])];
  let furthest = -1;
  let livingAtEnd = 0;
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const node = layout.byId.get(current)!;
    furthest = Math.max(furthest, node.creature.generation);
    if (node.creature.generation === lastGeneration && node.creature.alive) livingAtEnd++;
    stack.push(...node.offspring);
  }
  return { furthest, livingAtEnd };
}

export function lifeStory(run: Run, layout: Layout, id: string): Story {
  const node = layout.byId.get(id)!;
  const creature = node.creature;
  const byId = (other: string) => layout.byId.get(other)!.creature;
  const generationOf = (index: number) => run.generations.find((generation) => generation.index === index);
  const environment = (key: string) => run.environments[key]?.name ?? key;
  const last = layout.last;
  const events: LifeEvent[] = [];
  const life = creature.life;

  const previous = generationOf(creature.generation - 1);
  const worldChanged = previous && previous.environment !== node.environment;
  if (creature.parents.length === 0) {
    const pool = creature.ventShare === 1 ? "hydrothermal vent" : "desert cliff";
    events.push({
      kind: "birth",
      title: "Origin",
      body: [`One of the founders of the ${pool} population, released onto the ${environment(node.environment)} at the start of the world.`],
    });
  } else {
    const [first, second] = creature.parents;
    events.push({
      kind: "birth",
      title: `Born in generation ${creature.generation}`,
      body: [
        `Hatched into the ${environment(node.environment)}, the child of `,
        { id: first },
        " and ",
        { id: second },
        ".",
        ...(worldChanged ? [` The world had just turned into the ${environment(node.environment)}; its parents had grown up in the ${environment(previous.environment)}.`] : []),
      ],
    });
  }

  const genes = Object.keys(creature.dna);
  const parentsKnown = creature.parents.every((parent) => layout.byId.has(parent));
  if (creature.parents.length === 2 && !parentsKnown) {
    events.push({
      kind: "genes",
      title: "Inheritance",
      body: [`Its parents, ${creature.parents.join(" and ")}, lived in generation ${creature.generation - 1}, in an earlier era of this world.`],
    });
  } else if (creature.parents.length === 2) {
    const [a, b] = creature.parents.map(byId);
    const fromA = genes.filter((gene) => creature.dna[gene] === a.dna[gene] && a.dna[gene] !== b.dna[gene]).length;
    const fromB = genes.filter((gene) => creature.dna[gene] === b.dna[gene] && a.dna[gene] !== b.dna[gene]).length;
    const shared = genes.filter((gene) => a.dna[gene] === b.dna[gene] && creature.dna[gene] === a.dna[gene]).length;
    const body: Segment[] = [
      `It took ${plural(fromA, "gene")} from `,
      { id: a.id },
      `, ${plural(fromB, "gene")} from `,
      { id: b.id },
      `, and ${shared} that both parents carried.`,
    ];
    if (creature.mutations.length) {
      const described = creature.mutations.map((gene) => `its ${trait(creature, gene)}`).join(", ");
      body.push(` ${creature.mutations.length === 1 ? "A new mutation" : `${creature.mutations.length} new mutations`} changed ${described}.`);
    }
    events.push({ kind: "genes", title: "Inheritance", body });
  } else if (creature.mutations.length) {
    const described = creature.mutations.map((gene) => `its ${trait(creature, gene)}`).join(", ");
    events.push({ kind: "genes", title: "Inheritance", body: [`It differed from the rest of its population in ${described}.`] });
  }

  const probabilities = creature.survival.probabilities;
  const likeliest = Object.entries(probabilities).sort((x, y) => y[1] - x[1])[0];
  const assessment: Segment[] = [
    `Jev judged it most likely to ${OUTCOMES[Number(likeliest[0])]} here (${pct(likeliest[1])}), a survival score of ${creature.survival.score.toFixed(2)} out of 3.`,
  ];
  if (life) {
    assessment.push(
      ` Its greatest asset was its ${trait(creature, life.strength.choice)}; its greatest liability was its ${trait(creature, life.weakness.choice)}.`,
    );
  }
  events.push({ kind: "assessment", title: "Jev's assessment", body: assessment });

  const cause = life ? CAUSE_TEXT[life.cause.choice] ?? life.cause.choice : undefined;
  let headline: string;
  if (!creature.alive) {
    headline = cause ? `Died young, most likely of ${cause}` : "Died before it could breed";
    events.push({
      kind: "death",
      title: "Death",
      body: [
        cause
          ? `It died before it could breed. Jev's most likely cause of death: ${cause} (${pct(life!.cause.confidence)}).`
          : "It died before it could breed.",
      ],
    });
  } else if (creature.spared) {
    const alive = (generationOf(creature.generation)?.creatures ?? []).filter((c) => c.alive).length;
    headline = cause ? `Spared from ${cause} as one of the last` : "Spared as one of the last of its kind";
    events.push({
      kind: "spared",
      title: "Spared",
      body: [
        `By the odds it should have died${cause ? ` of ${cause}` : ""}, but so few of its generation made it that it was kept alive as one of the last ${alive} to carry the line on.`,
      ],
    });
  } else {
    const odds = creature.survival.chance < 0.4 ? `, against the odds (${pct(creature.survival.chance)} chance)` : creature.survival.chance > 0.85 ? ", as Jev expected" : "";
    headline = "Survived to adulthood";
    events.push({ kind: "survival", title: "Survival", body: [`It survived to adulthood${odds}.`] });
  }

  if (creature.alive) {
    const chosenBy = (generationOf(creature.generation)?.creatures ?? []).filter((c) => c.mate?.id === id && c.id !== creature.mate?.id).map((c) => c.id);
    if (creature.mate) {
      const ranked = Object.entries(creature.mate.probabilities).sort((x, y) => y[1] - x[1]);
      const confidence = creature.mate.probabilities[creature.mate.id] ?? 0;
      const body: Segment[] = [`Jev paired it with `, { id: creature.mate.id }, ` out of ${ranked.length} candidates (${pct(confidence)} confidence)`];
      if (confidence < 0.5 && ranked[1]) body.push(", a close call over ", { id: ranked[1][0] });
      body.push(".");
      if (chosenBy.length) body.push(` ${chosenBy.length === 1 ? "Another organism" : `${chosenBy.length} other organisms`} also chose it: `, ...list(chosenBy), ".");
      events.push({ kind: "mating", title: "Mating", body });
    }

    const children = node.offspring.map(byId);
    if (children.length) {
      const partners = [...new Set(children.flatMap((child) => child.parents.filter((parent) => parent !== id)))];
      const survivors = children.filter((child) => child.alive).length;
      headline = creature.spared
        ? `Spared from ${cause ?? "death"}, left ${children.length} offspring`
        : `Survived and left ${children.length} offspring`;
      events.push({
        kind: "offspring",
        title: "Offspring",
        body: [
          `It had ${children.length} offspring with `,
          ...list(partners),
          `: `,
          ...list(children.map((child) => child.id)),
          `. ${survivors} of them lived to breed.`,
        ],
      });
    } else if (creature.generation === last) {
      headline = creature.spared ? headline : "Alive when the run ended";
      events.push({ kind: "offspring", title: "Offspring", body: ["The run ended before its young were born."] });
    } else {
      headline = creature.spared ? headline : "Survived but never bred";
      events.push({
        kind: "offspring",
        title: "Offspring",
        body: ["It never had young. Fitter pairs filled the next generation before its turn came."],
      });
    }
  }

  const descendants = descendantCount(layout, id);
  if (descendants > 0) {
    const { furthest, livingAtEnd } = bloodline(layout, id, last);
    if (livingAtEnd > 0 && descendants >= 50) headline = `${headline}, ancestor of ${descendants}`;
    events.push({
      kind: "legacy",
      title: "Legacy",
      body: [
        livingAtEnd > 0
          ? `Its bloodline of ${descendants} descendants reached the end of the run, with ${livingAtEnd} still alive in generation ${last}.`
          : `Its bloodline of ${descendants} descendants died out in generation ${furthest}.`,
      ],
    });
  } else if (creature.generation < last || !creature.alive) {
    events.push({ kind: "legacy", title: "Legacy", body: ["It left no descendants."] });
  }

  return { headline, events };
}
