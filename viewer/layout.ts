import type { Individual, Run } from "./types";

export const COLUMN = 120;
export const INNER_RADIUS = 60;
export const RING_GAP = 60;

export type Node = {
  creature: Individual;
  environment: string;
  children: Node[];
  offspring: string[];
  primaryParent?: Node;
  // True when some descendant along the drawn tree is alive in the final generation.
  lineageSurvives: boolean;
  x: number;
  y: number;
  angle: number;
  radius: number;
  rx: number;
  ry: number;
};

// A layout can cover a window of a longer world, so generation numbers start at `first`.
export type Layout = { nodes: Node[]; byId: Map<string, Node>; generations: number; rows: number; first: number; last: number };

export function layoutRun(run: Run): Layout {
  const nodes: Node[] = [];
  const byId = new Map<string, Node>();
  const first = run.generations[0]?.index ?? 0;
  const last = run.generations[run.generations.length - 1]?.index ?? 0;
  for (const generation of run.generations) {
    for (const creature of generation.creatures) {
      const node: Node = {
        creature,
        environment: generation.environment,
        children: [],
        offspring: [],
        lineageSurvives: false,
        x: 0,
        y: 0,
        angle: 0,
        radius: 0,
        rx: 0,
        ry: 0,
      };
      nodes.push(node);
      byId.set(creature.id, node);
    }
  }

  const roots: Node[] = [];
  for (const node of nodes) {
    for (const parentId of new Set(node.creature.parents)) byId.get(parentId)?.offspring.push(node.creature.id);
    const parent = node.creature.parents[0] ? byId.get(node.creature.parents[0]) : undefined;
    if (parent) {
      node.primaryParent = parent;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const leaves = new Map<Node, number>();
  const measure = (node: Node): number => {
    let count = node.children.length === 0 ? 1 : 0;
    let survives = node.creature.generation === last && node.creature.alive;
    for (const child of node.children) {
      count += measure(child);
      survives = child.lineageSurvives || survives;
    }
    node.lineageSurvives = survives;
    leaves.set(node, count);
    return count;
  };
  roots.forEach(measure);

  // Ladderize: smaller clades first, the way phylogeny viewers order branches.
  const order = (a: Node, b: Node) =>
    leaves.get(a)! - leaves.get(b)! || b.creature.ventShare - a.creature.ventShare;
  roots.sort((a, b) => b.creature.ventShare - a.creature.ventShare || order(a, b));

  let row = 0;
  const place = (node: Node) => {
    node.x = (node.creature.generation - first) * COLUMN;
    if (node.children.length === 0) {
      node.y = row++;
      return;
    }
    node.children.sort(order);
    node.children.forEach(place);
    node.y = (node.children[0].y + node.children[node.children.length - 1].y) / 2;
  };
  roots.forEach(place);

  const rows = Math.max(1, row);
  for (const node of nodes) {
    node.angle = -Math.PI / 2 + ((node.y + 0.5) / rows) * Math.PI * 2;
    node.radius = INNER_RADIUS + (node.creature.generation - first) * RING_GAP;
    node.rx = Math.cos(node.angle) * node.radius;
    node.ry = Math.sin(node.angle) * node.radius;
  }

  return { nodes, byId, generations: run.generations.length, rows, first, last };
}

export function ancestors(layout: Layout, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    const node = layout.byId.get(current);
    if (node) stack.push(...node.creature.parents);
  }
  return seen;
}

export function descendantCount(layout: Layout, id: string): number {
  const seen = new Set<string>();
  const stack = [...(layout.byId.get(id)?.offspring ?? [])];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(layout.byId.get(current)?.offspring ?? []));
  }
  return seen.size;
}
