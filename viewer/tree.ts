import { lineageRgb, rgba, SLOT_COLORS } from "./color";
import { alleleOrigin, ORIGINS } from "./genome";
import { COLUMN, INNER_RADIUS, RING_GAP, type Layout, type Node } from "./layout";
import { drawCreature } from "./sprite";
import { colors } from "./theme";
import type { Run } from "./types";

const AXIS_HEIGHT = 46;
const MARGIN = { left: 56, right: 160, top: 18, bottom: 36 };
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 80;
const THUMB = 34;

export type Mode = "rect" | "radial";

export type Highlight = { ancestors: Set<string>; pathA: string[]; pathB: string[]; mrca?: string };

export type TreeCallbacks = {
  pick(id: string | undefined, secondary: boolean): void;
  hover(node: Node | undefined, clientX: number, clientY: number): void;
  zoomed(percent: number): void;
};

type View = { ox: number; oy: number; kx: number; ky: number };

export class TreeView {
  mode: Mode = "rect";
  progress = 0;
  a?: string;
  b?: string;
  highlight: Highlight = { ancestors: new Set(), pathA: [], pathB: [] };

  private readonly ctx: CanvasRenderingContext2D;
  private run?: Run;
  private layout?: Layout;
  private width = 0;
  private height = 0;
  private view: View = { ox: 0, oy: 0, kx: 1, ky: 1 };
  private target?: View;
  private fitKx = 1;
  private hovered?: Node;
  private readonly thumbs = new Map<string, HTMLCanvasElement>();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly callbacks: TreeCallbacks,
  ) {
    this.ctx = canvas.getContext("2d")!;
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    this.bindInput();
    const loop = () => {
      this.step();
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // Live updates keep the camera where the viewer left it, unless the window slid.
  setRun(run: Run, layout: Layout, keepView = false) {
    const sameWindow = this.layout?.first === layout.first;
    this.run = run;
    this.layout = layout;
    if (!keepView) this.thumbs.clear();
    if (!keepView || !sameWindow) this.fit(false);
  }

  setMode(mode: Mode) {
    this.mode = mode;
    this.fit(false);
  }

  fit(animate = true) {
    if (!this.layout) return;
    const next = this.fittedView();
    this.fitKx = next.kx;
    this.moveTo(next, animate);
  }

  zoom(factor: number, px = this.width / 2, py = this.height / 2) {
    this.target = undefined;
    const view = this.view;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (view.kx * factor) / this.fitKx));
    const f = (clamped * this.fitKx) / view.kx;
    view.kx *= f;
    view.ox = px - (px - view.ox) * f;
    view.oy = py - (py - view.oy) * f;
    if (this.mode === "rect") view.ky *= f;
    this.callbacks.zoomed(Math.round((view.kx / this.fitKx) * 100));
  }

  spreadRows(factor: number, py = this.height / 2) {
    if (this.mode !== "rect") return;
    this.target = undefined;
    const view = this.view;
    const next = Math.min(400, Math.max(0.5, view.ky * factor));
    const f = next / view.ky;
    view.ky = next;
    view.oy = py - (py - view.oy) * f;
  }

  focus(ids: string[]) {
    const nodes = ids.map((id) => this.layout?.byId.get(id)).filter((node): node is Node => !!node);
    if (nodes.length === 0) return;
    const plotW = this.width - MARGIN.left - MARGIN.right;
    const plotH = this.height - this.plotTop() - MARGIN.bottom;
    if (this.mode === "rect") {
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const spanX = Math.max(Math.max(...xs) - Math.min(...xs), COLUMN * 3);
      const spanY = Math.max(Math.max(...ys) - Math.min(...ys), 14);
      const kx = Math.min((plotW * 0.8) / spanX, this.fitKx * MAX_ZOOM);
      const ky = Math.max((plotH * 0.8) / spanY, 4);
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      this.moveTo({ kx, ky, ox: MARGIN.left + plotW / 2 - cx * kx, oy: this.plotTop() + plotH / 2 - cy * ky }, true);
    } else {
      const xs = nodes.map((n) => n.rx);
      const ys = nodes.map((n) => n.ry);
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), RING_GAP * 4);
      const k = Math.min(this.width, this.height) / (span * 1.4);
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      this.moveTo({ kx: k, ky: k, ox: this.width / 2 - cx * k, oy: this.height / 2 - cy * k }, true);
    }
  }

  private plotTop() {
    return this.mode === "rect" ? AXIS_HEIGHT + MARGIN.top : MARGIN.top;
  }

  private fittedView(): View {
    const layout = this.layout!;
    if (this.mode === "rect") {
      const plotW = this.width - MARGIN.left - MARGIN.right;
      const plotH = this.height - this.plotTop() - MARGIN.bottom;
      const kx = plotW / (COLUMN * Math.max(1, layout.generations - 1));
      const ky = plotH / Math.max(1, layout.rows - 1);
      return { kx, ky, ox: MARGIN.left, oy: this.plotTop() };
    }
    const outer = INNER_RADIUS + (layout.generations - 1) * RING_GAP + 40;
    const k = Math.min(this.width, this.height) / (outer * 2);
    return { kx: k, ky: k, ox: this.width / 2, oy: this.height / 2 };
  }

  private moveTo(next: View, animate: boolean) {
    if (animate) {
      this.target = next;
    } else {
      this.view = next;
      this.target = undefined;
    }
    this.callbacks.zoomed(Math.round((next.kx / this.fitKx) * 100));
  }

  private step() {
    if (!this.target) return;
    const t = this.target;
    const v = this.view;
    const ease = 0.22;
    v.ox += (t.ox - v.ox) * ease;
    v.oy += (t.oy - v.oy) * ease;
    v.kx += (t.kx - v.kx) * ease;
    v.ky += (t.ky - v.ky) * ease;
    if (Math.abs(t.ox - v.ox) + Math.abs(t.oy - v.oy) < 0.5 && Math.abs(t.kx - v.kx) / t.kx < 0.002) {
      this.view = t;
      this.target = undefined;
    }
  }

  private resize() {
    const parent = this.canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const first = this.width === 0;
    this.width = parent.clientWidth;
    this.height = parent.clientHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (first || !this.target) this.fit(false);
  }

  private point(node: Node) {
    const v = this.view;
    return this.mode === "rect"
      ? { x: v.ox + node.x * v.kx, y: v.oy + node.y * v.ky }
      : { x: v.ox + node.rx * v.kx, y: v.oy + node.ry * v.kx };
  }

  private reveal(generation: number) {
    return Math.max(0, Math.min(1, this.progress - (generation - (this.layout?.first ?? 0))));
  }

  private radius(node: Node) {
    const boost = this.mode === "rect" ? Math.min(1, Math.max(0, (this.view.ky - 8) / 16)) * 2 : 0;
    return 2.2 + node.creature.survival.score * 0.75 + boost;
  }

  private emphasized(): Set<string> | undefined {
    if (!this.a) return;
    if (this.b) return new Set([...this.highlight.pathA, ...this.highlight.pathB]);
    return this.highlight.ancestors;
  }

  private draw() {
    const ctx = this.ctx;
    ctx.fillStyle = colors().canvas;
    ctx.fillRect(0, 0, this.width, this.height);
    if (!this.run || !this.layout) return;

    if (this.mode === "rect") this.drawColumns();
    else this.drawRings();

    const emphasized = this.emphasized();
    this.drawBranches(!!emphasized);
    this.drawHighlights();
    this.drawNodes(emphasized);
    this.drawMarkers();
    if (this.mode === "rect") this.drawAxis();
  }

  private drawColumns() {
    const ctx = this.ctx;
    const { ox, kx } = this.view;
    const half = (COLUMN * kx) / 2;
    for (const generation of this.run!.generations) {
      const visible = this.reveal(generation.index);
      const cx = ox + (generation.index - this.layout!.first) * COLUMN * kx;
      if (cx + half < 0 || cx - half > this.width) continue;
      ctx.globalAlpha = 0.35 + 0.65 * visible;
      ctx.fillStyle = colors().bands[generation.environment] ?? colors().canvas;
      ctx.fillRect(cx - half, AXIS_HEIGHT, half * 2, this.height - AXIS_HEIGHT);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors().grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(cx) + 0.5, AXIS_HEIGHT);
      ctx.lineTo(Math.round(cx) + 0.5, this.height);
      ctx.stroke();
    }
  }

  private drawRings() {
    const ctx = this.ctx;
    const { ox, oy, kx } = this.view;
    const run = this.run!;
    for (const generation of run.generations) {
      const radius = (INNER_RADIUS + (generation.index - this.layout!.first) * RING_GAP) * kx;
      ctx.strokeStyle = colors().bands[generation.environment] ?? colors().canvas;
      ctx.lineWidth = RING_GAP * kx;
      ctx.globalAlpha = 0.35 + 0.65 * this.reveal(generation.index);
      ctx.beginPath();
      ctx.arc(ox, oy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    run.generations.forEach((generation, i) => {
      if (i > 0 && run.generations[i - 1].environment === generation.environment) return;
      const radius = (INNER_RADIUS + (generation.index - this.layout!.first) * RING_GAP) * kx;
      const label = `${run.environments[generation.environment]?.name ?? generation.environment} · G${generation.index}`;
      ctx.font = "500 11px Geist, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = colors().canvas;
      ctx.strokeText(label, ox, oy - radius + 4);
      ctx.fillStyle = colors().inks[generation.environment] ?? colors().axisText;
      ctx.fillText(label, ox, oy - radius + 4);
    });
  }

  private traceBranch(parent: Node, child: Node, visible: number) {
    const ctx = this.ctx;
    const p = this.point(parent);
    const c = this.point(child);
    ctx.moveTo(p.x, p.y);
    if (this.mode === "rect") {
      ctx.lineTo(p.x, c.y);
      ctx.lineTo(p.x + (c.x - p.x) * visible, c.y);
      return;
    }
    const { ox, oy, kx } = this.view;
    const r = parent.radius * kx;
    ctx.arc(ox, oy, r, parent.angle, child.angle, child.angle < parent.angle);
    const reach = r + (child.radius * kx - r) * visible;
    ctx.lineTo(ox + Math.cos(child.angle) * reach, oy + Math.sin(child.angle) * reach);
  }

  private visibleSegment(a: { x: number; y: number }, b: { x: number; y: number }) {
    return !(
      (a.x < -20 && b.x < -20) ||
      (a.x > this.width + 20 && b.x > this.width + 20) ||
      (a.y < -20 && b.y < -20) ||
      (a.y > this.height + 20 && b.y > this.height + 20)
    );
  }

  private drawBranches(muted: boolean) {
    const ctx = this.ctx;
    for (const node of this.layout!.nodes) {
      const parent = node.primaryParent;
      if (!parent) continue;
      const visible = this.reveal(node.creature.generation);
      if (visible <= 0) continue;
      if (this.mode === "rect" && !this.visibleSegment(this.point(parent), this.point(node))) continue;
      const living = node.lineageSurvives;
      const alpha = (living ? 0.85 : 0.5) * (muted ? 0.35 : 1);
      ctx.strokeStyle = living ? rgba(lineageRgb(node.creature.ventShare), alpha) : rgba(colors().deadBranch, alpha);
      ctx.lineWidth = living ? 1.4 : 0.9;
      ctx.beginPath();
      this.traceBranch(parent, node, visible);
      ctx.stroke();
    }
  }

  private drawLink(childId: string, parentId: string, color: string, width: number) {
    const child = this.layout!.byId.get(childId);
    const parent = this.layout!.byId.get(parentId);
    if (!child || !parent) return;
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    if (child.primaryParent === parent) {
      this.traceBranch(parent, child, 1);
    } else {
      const p = this.point(parent);
      const c = this.point(child);
      ctx.setLineDash([5, 4]);
      ctx.moveTo(p.x, p.y);
      ctx.bezierCurveTo((p.x + c.x) / 2, p.y, (p.x + c.x) / 2, c.y, c.x, c.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawHighlights() {
    if (!this.a) return;
    const layout = this.layout!;
    if (this.b) {
      const { pathA, pathB } = this.highlight;
      for (let i = 0; i < pathA.length - 1; i++) this.drawLink(pathA[i], pathA[i + 1], SLOT_COLORS.a, 2.8);
      for (let i = 0; i < pathB.length - 1; i++) this.drawLink(pathB[i], pathB[i + 1], SLOT_COLORS.b, 2.8);
      return;
    }
    for (const id of this.highlight.ancestors) {
      const node = layout.byId.get(id);
      if (!node) continue;
      for (const parent of new Set(node.creature.parents)) {
        if (this.highlight.ancestors.has(parent)) this.drawLink(id, parent, colors().ancestry, 1.8);
      }
    }
  }

  private drawNodes(emphasized: Set<string> | undefined) {
    const ctx = this.ctx;
    const { kx, ky } = this.view;
    const columnPx = COLUMN * kx;
    const rect = this.mode === "rect";
    const showLabels = rect ? ky >= 11 && columnPx >= 80 : kx / this.fitKx >= 3;
    const showGenes = rect && ky >= 15 && columnPx >= 170;
    const showThumbs = rect && ky >= 40 && columnPx >= 230;

    for (const node of this.layout!.nodes) {
      const visible = this.reveal(node.creature.generation);
      if (visible < 0.7) continue;
      const p = this.point(node);
      if (p.x < -40 || p.x > this.width + 200 || p.y < -40 || p.y > this.height + 40) continue;
      const { creature } = node;
      const r = this.radius(node);
      const dim = emphasized && !emphasized.has(creature.id) ? 0.3 : 1;
      ctx.globalAlpha = ((visible - 0.7) / 0.3) * dim;

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (creature.alive) {
        ctx.fillStyle = rgba(lineageRgb(creature.ventShare), 1);
        ctx.fill();
        ctx.strokeStyle = colors().nodeRing;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = colors().deadFill;
        ctx.fill();
        ctx.strokeStyle = colors().faint;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
      if (creature.spared) {
        ctx.strokeStyle = colors().spared;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (node === this.hovered) {
        ctx.strokeStyle = colors().hoverRing;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (!showLabels) continue;
      let x = p.x + r + 6;
      if (showThumbs) {
        ctx.drawImage(this.thumb(node), x, p.y - THUMB / 2, THUMB, THUMB);
        x += THUMB + 6;
      }
      ctx.font = "10px 'Geist Mono', ui-monospace, Menlo, monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = creature.alive ? colors().label : colors().faint;
      ctx.fillText(creature.id, x, p.y + 3.5);
      x += ctx.measureText(creature.id).width + 6;
      if (showGenes) {
        for (const trait of Object.keys(creature.dna)) {
          ctx.fillStyle = ORIGINS[alleleOrigin(creature, trait)].color;
          ctx.fillRect(x, p.y - 4, 3.5, 8);
          x += 4.5;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawMarkers() {
    const layout = this.layout!;
    const mark = (id: string | undefined, color: string, text: string, textColor = "#ffffff") => {
      const node = id ? layout.byId.get(id) : undefined;
      if (!node || this.reveal(node.creature.generation) < 0.7) return;
      const ctx = this.ctx;
      const p = this.point(node);
      const r = this.radius(node);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = "500 10px Geist, system-ui, sans-serif";
      const label = `${text} · ${node.creature.id}`;
      const w = ctx.measureText(label).width + 12;
      const bx = Math.min(this.width - w - 4, Math.max(4, p.x - w / 2));
      const by = p.y - r - 26;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, by, w, 17, 8.5);
      ctx.fill();
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.fillText(label, bx + w / 2, by + 12);
    };
    if (this.b) mark(this.highlight.mrca, colors().mrca, "Common ancestor", colors().mrcaText);
    mark(this.a, SLOT_COLORS.a, "A");
    mark(this.b, SLOT_COLORS.b, "B");
  }

  private drawAxis() {
    const ctx = this.ctx;
    const run = this.run!;
    const { ox, kx } = this.view;
    const columnPx = COLUMN * kx;
    ctx.fillStyle = colors().axis;
    ctx.fillRect(0, 0, this.width, AXIS_HEIGHT);
    ctx.strokeStyle = colors().axisBorder;
    ctx.beginPath();
    ctx.moveTo(0, AXIS_HEIGHT - 0.5);
    ctx.lineTo(this.width, AXIS_HEIGHT - 0.5);
    ctx.stroke();

    let start = 0;
    run.generations.forEach((generation, i) => {
      const next = run.generations[i + 1];
      if (next && next.environment === generation.environment) return;
      const x0 = Math.max(0, ox + start * COLUMN * kx - columnPx / 2);
      const x1 = Math.min(this.width, ox + i * COLUMN * kx + columnPx / 2);
      start = i + 1;
      if (x1 - x0 < 8) return;
      const ink = colors().inks[generation.environment] ?? colors().axisText;
      ctx.fillStyle = ink;
      ctx.fillRect(x0 + 2, 22, x1 - x0 - 4, 2);
      if (x1 - x0 > 70) {
        ctx.font = "500 11px Geist, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(run.environments[generation.environment]?.name ?? generation.environment, x0 + 6, 16);
      }
    });

    const every = Math.max(1, Math.ceil(34 / columnPx));
    ctx.font = "10px 'Geist Mono', ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = colors().axisText;
    for (const generation of run.generations) {
      if (generation.index % every) continue;
      const x = ox + (generation.index - this.layout!.first) * COLUMN * kx;
      if (x < -20 || x > this.width + 20) continue;
      ctx.fillText(`G${generation.index}`, x, 38);
    }
  }

  private thumb(node: Node): HTMLCanvasElement {
    const cached = this.thumbs.get(node.creature.id);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = THUMB * 2;
    canvas.height = THUMB * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#121212";
    ctx.beginPath();
    ctx.roundRect(0, 0, THUMB * 2, THUMB * 2, 12);
    ctx.fill();
    drawCreature(ctx, node.creature.dna, node.creature.id, THUMB, THUMB - 4, THUMB * 2);
    this.thumbs.set(node.creature.id, canvas);
    return canvas;
  }

  private hitTest(x: number, y: number): Node | undefined {
    let best: Node | undefined;
    let bestDistance = Infinity;
    for (const node of this.layout?.nodes ?? []) {
      if (this.reveal(node.creature.generation) < 0.7) continue;
      const p = this.point(node);
      const distance = Math.hypot(p.x - x, p.y - y);
      if (distance < Math.max(8, this.radius(node) + 3) && distance < bestDistance) {
        best = node;
        bestDistance = distance;
      }
    }
    return best;
  }

  private bindInput() {
    const canvas = this.canvas;
    let drag: { x: number; y: number; moved: boolean } | undefined;
    const local = (event: MouseEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };

    canvas.addEventListener("pointerdown", (event) => {
      drag = { x: event.clientX, y: event.clientY, moved: false };
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (drag) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 3) {
          drag.moved = true;
          canvas.classList.add("dragging");
        }
        if (drag.moved) {
          this.target = undefined;
          this.view.ox += dx;
          this.view.oy += dy;
          drag.x = event.clientX;
          drag.y = event.clientY;
          this.hovered = undefined;
          this.callbacks.hover(undefined, 0, 0);
          return;
        }
      }
      const { x, y } = local(event);
      this.hovered = this.hitTest(x, y);
      canvas.style.cursor = this.hovered ? "pointer" : "";
      this.callbacks.hover(this.hovered, event.clientX, event.clientY);
    });

    canvas.addEventListener("pointerup", (event) => {
      canvas.classList.remove("dragging");
      if (drag && !drag.moved) {
        const { x, y } = local(event);
        this.callbacks.pick(this.hitTest(x, y)?.creature.id, event.shiftKey || event.metaKey || event.ctrlKey);
      }
      drag = undefined;
    });

    canvas.addEventListener("pointerleave", () => {
      this.hovered = undefined;
      this.callbacks.hover(undefined, 0, 0);
    });

    canvas.addEventListener("dblclick", (event) => {
      const { x, y } = local(event);
      this.zoom(2, x, y);
    });

    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const { x, y } = local(event);
        const scale = event.deltaMode === 1 ? 16 : 1;
        const dx = event.deltaX * scale;
        const dy = event.deltaY * scale;
        const factor = Math.exp(-Math.max(-60, Math.min(60, dy)) * 0.01);
        if (event.ctrlKey || event.metaKey) {
          this.zoom(factor, x, y);
        } else if (event.altKey) {
          this.spreadRows(factor, y);
        } else {
          this.target = undefined;
          this.view.ox -= event.shiftKey ? dy : dx;
          this.view.oy -= event.shiftKey ? 0 : dy;
        }
      },
      { passive: false },
    );
  }
}
