import type { Base } from "./genome";
import { ICONS } from "./icons";
import { drawCreature } from "./sprite";
import { colors } from "./theme";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label: string, onClick: () => void, className = "btn") {
  const node = el("button", className, label);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

export function iconButton(icon: keyof typeof ICONS, label: string, onClick: () => void) {
  const node = el("button", "icon-btn");
  node.type = "button";
  node.innerHTML = ICONS[icon];
  node.setAttribute("aria-label", label);
  node.addEventListener("click", onClick);
  return node;
}

export function idLink(id: string, onClick: (id: string) => void) {
  return button(id, () => onClick(id), "id-link");
}

export function section(title: string, ...children: (Node | string)[]) {
  const node = el("section", "section");
  node.append(el("h3", undefined, title), ...children);
  return node;
}

export function metrics(entries: [string, string | Node][]) {
  const grid = el("dl", "metrics");
  for (const [label, value] of entries) {
    const item = el("div");
    const dd = el("dd");
    dd.append(value);
    item.append(el("dt", undefined, label), dd);
    grid.append(item);
  }
  return grid;
}

export function specimen(dna: Record<string, string>, id: string, height: number) {
  const canvas = el("canvas", "specimen");
  canvas.style.height = `${height}px`;
  requestAnimationFrame(() => {
    const width = canvas.clientWidth || height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    drawCreature(ctx, dna, id, width / 2, height * 0.44, Math.min(width, height));
  });
  return canvas;
}

export function sequence(bases: string, compareTo?: string) {
  const node = el("span", "sequence");
  [...bases].forEach((base, i) => {
    const letter = el("span", compareTo && compareTo[i] !== base ? "base mismatch" : "base", base);
    letter.style.color = colors().bases[base as Base];
    node.append(letter);
  });
  return node;
}

export function pill(text: string, tone: "good" | "bad" | "warn" | "neutral") {
  return el("span", `pill ${tone}`, text);
}
