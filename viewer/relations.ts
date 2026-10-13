import type { Layout } from "./layout";

export type Relation = {
  label: string;
  mrca?: string;
  sharedAncestors: string[];
  stepsA: number;
  stepsB: number;
  // From the organism up to the common ancestor, both ends included.
  pathA: string[];
  pathB: string[];
  relatedness: number;
};

function climb(layout: Layout, id: string): Map<string, string | undefined> {
  const reachedFrom = new Map<string, string | undefined>([[id, undefined]]);
  const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const parent of layout.byId.get(current)?.creature.parents ?? []) {
      if (reachedFrom.has(parent) || !layout.byId.has(parent)) continue;
      reachedFrom.set(parent, current);
      queue.push(parent);
    }
  }
  return reachedFrom;
}

function pathUp(reachedFrom: Map<string, string | undefined>, ancestor: string): string[] {
  const path = [ancestor];
  let current = reachedFrom.get(ancestor);
  while (current !== undefined) {
    path.unshift(current);
    current = reachedFrom.get(current);
  }
  return path;
}

function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

function removed(n: number): string {
  return n === 1 ? "once removed" : n === 2 ? "twice removed" : `${n} times removed`;
}

function ancestorTitle(steps: number): string {
  if (steps === 1) return "parent";
  if (steps === 2) return "grandparent";
  return `${"great-".repeat(steps - 2)}grandparent`;
}

function name(layout: Layout, a: string, b: string, stepsA: number, stepsB: number, shared: number): string {
  const low = Math.min(stepsA, stepsB);
  const high = Math.max(stepsA, stepsB);
  const [older, younger] = stepsA < stepsB ? [a, b] : [b, a];
  if (low === 0) return `${older} is ${younger}'s ${ancestorTitle(high)}`;
  if (low === 1 && high === 1) return shared >= 2 ? "Full siblings" : "Half siblings";
  if (low === 1) return `${older} is ${younger}'s ${"great-".repeat(high - 2)}aunt or uncle`;
  const half = shared < 2 ? "Half " : "";
  const cousins = `${half}${ordinal(low - 1)} cousins`;
  return high === low ? cousins : `${cousins}, ${removed(high - low)}`;
}

export function relatedness(layout: Layout, a: string, b: string): number {
  const memo = new Map<string, number>();
  const generation = (id: string) => layout.byId.get(id)?.creature.generation ?? 0;
  const parents = (id: string) => layout.byId.get(id)?.creature.parents ?? [];

  const kinship = (x: string, y: string): number => {
    const key = x < y ? `${x}|${y}` : `${y}|${x}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let value: number;
    if (x === y) {
      const [p, q] = parents(x);
      value = p && q ? 0.5 * (1 + kinship(p, q)) : 0.5;
    } else {
      const [newer, other] = generation(x) >= generation(y) ? [x, y] : [y, x];
      const [p, q] = parents(newer);
      value = p && q ? 0.5 * (kinship(p, other) + kinship(q, other)) : 0;
    }
    memo.set(key, value);
    return value;
  };
  // Wright's coefficient, normalised by each organism's own inbreeding.
  const inbreeding = (id: string) => {
    const [p, q] = parents(id);
    return p && q ? kinship(p, q) : 0;
  };
  return (2 * kinship(a, b)) / Math.sqrt((1 + inbreeding(a)) * (1 + inbreeding(b)));
}

export function relate(layout: Layout, a: string, b: string): Relation {
  const fromA = climb(layout, a);
  const fromB = climb(layout, b);
  const generation = (id: string) => layout.byId.get(id)!.creature.generation;
  const common = [...fromA.keys()].filter((id) => fromB.has(id));
  const score = relatedness(layout, a, b);

  if (common.length === 0) {
    return {
      label: "Unrelated: they descend from different founders",
      sharedAncestors: [],
      stepsA: 0,
      stepsB: 0,
      pathA: [a],
      pathB: [b],
      relatedness: score,
    };
  }

  const nearest = Math.max(...common.map(generation));
  const shared = common.filter((id) => generation(id) === nearest);
  const mrca = shared[0];
  const stepsA = generation(a) - nearest;
  const stepsB = generation(b) - nearest;
  return {
    label: a === b ? "Same organism" : name(layout, a, b, stepsA, stepsB, shared.length),
    mrca,
    sharedAncestors: shared,
    stepsA,
    stepsB,
    pathA: pathUp(fromA, mrca),
    pathB: pathUp(fromB, mrca),
    relatedness: score,
  };
}
