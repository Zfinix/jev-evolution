import { renderCompare } from "./compare";
import { ICONS } from "./icons";
import type { InspectorContext } from "./inspector";
import { ancestors, layoutRun, type Layout, type Node } from "./layout";
import { renderOrganism } from "./organism";
import { renderOverview } from "./overview";
import { relate } from "./relations";
import { drawCreature } from "./sprite";
import { lifeStory } from "./story";
import { currentTheme, toggleTheme } from "./theme";
import { TreeView, type Mode } from "./tree";
import type { Run, WorldStatus } from "./types";

const GROW_MS = 650;
const WORLD = "world";
const WINDOW = 30;
const POLL_MS = 5000;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const canvas = $<HTMLCanvasElement>("#tree");
const inspector = $("#inspector");
const tooltip = $("#tooltip");
const runSelect = $<HTMLSelectElement>("#run-select");
const eraField = $("#era-field");
const eraSelect = $<HTMLSelectElement>("#era-select");
const search = $<HTMLInputElement>("#search");
const organismIds = $("#organism-ids");
const pickBanner = $("#pick-banner");
const zoomLevel = $("#zoom-level");
const rowTools = $("#row-tools");
const playButton = $<HTMLButtonElement>("#play");
const scrub = $<HTMLInputElement>("#scrub");
const genLabel = $("#gen-label");
const announcer = $("#announcer");
const segmented = $(".segmented");
const themeToggle = $<HTMLButtonElement>("#theme-toggle");
const advance = $("#advance");
const eventSelect = $<HTMLSelectElement>("#event-select");
const advanceButton = $<HTMLButtonElement>("#advance-button");
const advanceStatus = $("#advance-status");

const state: {
  run?: Run;
  layout?: Layout;
  a?: string;
  b?: string;
  picking: boolean;
  playing: boolean;
  source?: string;
  world?: WorldStatus;
  // Start of the era being viewed; undefined follows the latest generations.
  era?: number;
  requesting: boolean;
} = { picking: false, playing: false, requesting: false };

const tree = new TreeView(canvas, {
  pick: (id, secondary) => {
    if (!id) {
      if (!state.picking) clearAll();
      return;
    }
    if ((state.picking || secondary) && state.a && id !== state.a) {
      state.b = id;
      state.picking = false;
      refresh();
      focusComparison();
      return;
    }
    state.a = id;
    state.b = undefined;
    state.picking = false;
    refresh();
  },
  hover: showTooltip,
  zoomed: (percent) => {
    zoomLevel.textContent = `${percent}%`;
  },
});

function clearAll() {
  state.a = undefined;
  state.b = undefined;
  state.picking = false;
  refresh();
}

function refresh() {
  const { run, layout, a, b } = state;
  if (!run || !layout) return;
  tree.a = a;
  tree.b = b;
  if (a && b) {
    const relation = relate(layout, a, b);
    tree.highlight = { ancestors: new Set(), pathA: relation.pathA, pathB: relation.pathB, mrca: relation.mrca };
  } else if (a) {
    tree.highlight = { ancestors: ancestors(layout, a), pathA: [], pathB: [] };
  } else {
    tree.highlight = { ancestors: new Set(), pathA: [], pathB: [] };
  }
  pickBanner.hidden = !state.picking;
  announcer.textContent = a && b ? `Comparing ${a} with ${b}` : a ? `Inspecting ${a}` : state.picking ? "Choose a second organism" : "";

  const context: InspectorContext = {
    run,
    layout,
    a,
    b,
    picking: state.picking,
    select: (id, slot) => {
      if (!layout.byId.has(id)) return;
      state.picking = false;
      if (slot === "b" && state.a && id !== state.a) {
        state.b = id;
        refresh();
        focusComparison();
        return;
      }
      state.a = id;
      state.b = undefined;
      refresh();
    },
    clear: (slot) => {
      if (slot === "a") {
        state.a = state.b;
        state.b = undefined;
      } else {
        state.b = undefined;
      }
      refresh();
    },
    swap: () => {
      [state.a, state.b] = [state.b, state.a];
      refresh();
    },
    pickSecond: () => {
      state.picking = !state.picking;
      refresh();
    },
    zoomTo: (ids) => tree.focus(ids),
  };

  const scroll = inspector.scrollTop;
  const sameView = inspector.dataset.view === `${a}|${b}`;
  inspector.dataset.view = `${a}|${b}`;
  inspector.replaceChildren(
    ...(a && b ? renderCompare(context, a, b) : a ? renderOrganism(context, a) : renderOverview(context)),
  );
  inspector.scrollTop = sameView ? scroll : 0;
}

function focusComparison() {
  const { mrca } = tree.highlight;
  if (state.a && state.b) tree.focus([state.a, state.b, ...(mrca ? [mrca] : [])]);
}

function showTooltip(node: Node | undefined, clientX: number, clientY: number) {
  if (!node) {
    tooltip.hidden = true;
    return;
  }
  const { creature } = node;
  const sprite = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  sprite.width = 56 * dpr;
  sprite.height = 56 * dpr;
  const ctx = sprite.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, 56, 56);
  drawCreature(ctx, creature.dna, creature.id, 28, 25, 56);
  const text = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `${creature.id} · G${creature.generation}`;
  const detail = document.createElement("div");
  detail.textContent = state.run && state.layout ? lifeStory(state.run, state.layout, creature.id).headline : "";
  const hint = document.createElement("div");
  hint.className = "muted";
  hint.textContent = state.a && creature.id !== state.a ? "Click to inspect · Shift-click to compare" : "Click to inspect";
  text.append(title, detail, hint);
  tooltip.replaceChildren(sprite, text);
  tooltip.hidden = false;
  tooltip.style.left = `${Math.min(clientX + 16, innerWidth - 280)}px`;
  tooltip.style.top = `${Math.min(clientY + 16, innerHeight - 90)}px`;
}

function setPlaying(playing: boolean) {
  state.playing = playing;
  playButton.innerHTML = playing ? ICONS.pause : ICONS.play;
  playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
}

function syncTimeline() {
  const run = state.run;
  if (!run || run.generations.length === 0) return;
  const position = Math.max(0, Math.min(run.generations.length - 1, Math.ceil(tree.progress) - 1));
  const generation = run.generations[position];
  const alive = generation.creatures.filter((creature) => creature.alive).length;
  scrub.value = String(tree.progress);
  const environment = run.environments[generation.environment]?.name ?? generation.environment;
  genLabel.textContent = `G${generation.index} · ${environment} · ${alive}/${generation.creatures.length} survived`;
}

let last = performance.now();
function tick(now: number) {
  const delta = now - last;
  last = now;
  if (state.playing && state.layout) {
    tree.progress = Math.min(state.layout.generations, tree.progress + delta / GROW_MS);
    if (tree.progress >= state.layout.generations) setPlaying(false);
    syncTimeline();
  }
  requestAnimationFrame(tick);
}

function show(run: Run, options: { progress?: number; keepView?: boolean; keepSelection?: boolean } = {}) {
  const layout = layoutRun(run);
  const keep = (id: string | undefined) => (options.keepSelection && id && layout.byId.has(id) ? id : undefined);
  Object.assign(state, { run, layout, a: keep(state.a), b: keep(state.b) });
  if (!state.a) state.b = undefined;
  if (!options.keepSelection) state.picking = false;
  organismIds.replaceChildren(
    ...layout.nodes.map((node) => {
      const option = document.createElement("option");
      option.value = node.creature.id;
      return option;
    }),
  );
  scrub.max = String(layout.generations);
  tree.setRun(run, layout, options.keepView);
  tree.progress = options.progress ?? 0;
  setPlaying(tree.progress < layout.generations);
  syncTimeline();
  refresh();
}

async function loadSaved(name: string) {
  state.source = name;
  state.world = undefined;
  state.era = undefined;
  show(await (await fetch(`runs/${name}`)).json());
  syncWorldControls();
}

async function loadWorld(options: { grow?: boolean; keepView?: boolean } = {}) {
  const query = state.era === undefined ? "" : `?from=${state.era}`;
  const response = await fetch(`api/world${query}`);
  if (!response.ok) throw new Error(`world returned ${response.status}`);
  const run: Run = await response.json();
  state.source = WORLD;
  state.world = run.world;
  const progress = options.grow ? Math.max(0, run.generations.length - 1) : 0;
  show(run, { progress, keepView: options.keepView, keepSelection: options.keepView });
  syncWorldControls();
}

function syncWorldControls() {
  const world = state.source === WORLD ? state.world : undefined;
  eraField.hidden = !world;
  advance.hidden = !world;
  if (!world) return;

  const eras = Math.ceil(world.generations / WINDOW);
  if (eraSelect.dataset.generations !== String(world.generations)) {
    eraSelect.dataset.generations = String(world.generations);
    const latest = new Option("Latest generations", "");
    const options = Array.from({ length: eras }, (_, i) => {
      const start = i * WINDOW;
      return new Option(`G${start} to G${Math.min(start + WINDOW, world.generations) - 1}`, String(start));
    });
    eraSelect.replaceChildren(latest, ...options);
  }
  eraSelect.value = state.era === undefined ? "" : String(state.era);

  const current = state.run?.environments[world.environment]?.name ?? world.environment;
  eventSelect.options[0].textContent = `Same world (${current})`;
  syncAdvanceButton();
}

function syncAdvanceButton() {
  const world = state.world;
  if (!world || state.source !== WORLD) return;
  const waitSeconds = Math.ceil((world.cooldownEndsAt - Date.now()) / 1000);
  let label = "Next generation";
  let disabled = false;
  if (world.generations >= world.cap) {
    label = `World complete · ${world.cap} generations`;
    disabled = true;
  } else if (state.requesting || world.advancing) {
    label = "Jev is judging…";
    disabled = true;
  } else if (waitSeconds > 0) {
    label = `Next generation in ${waitSeconds}s`;
    disabled = true;
  }
  advanceButton.textContent = label;
  advanceButton.disabled = disabled;
  eventSelect.disabled = disabled;
}

let statusTimer: ReturnType<typeof setTimeout> | undefined;
function showStatus(message: string) {
  advanceStatus.textContent = message;
  advanceStatus.hidden = !message;
  announcer.textContent = message;
  clearTimeout(statusTimer);
  if (message) statusTimer = setTimeout(() => (advanceStatus.hidden = true), 7000);
}

advanceButton.addEventListener("click", async () => {
  if (advanceButton.disabled) return;
  state.requesting = true;
  syncAdvanceButton();
  showStatus("Jev is judging every organism in the next generation. This takes a few seconds.");
  try {
    const response = await fetch("api/world/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ environment: eventSelect.value || undefined }),
    });
    const result: { ok: boolean; status: WorldStatus; message?: string } = await response.json();
    state.world = result.status;
    state.requesting = false;
    if (result.ok) {
      showStatus(`Generation ${result.status.generations - 1} is here.`);
      eventSelect.value = "";
      state.era = undefined;
      await loadWorld({ grow: true, keepView: true });
    } else {
      showStatus(result.message ?? "Something went wrong, so nothing changed. Try again in a minute.");
      syncWorldControls();
    }
  } catch {
    state.requesting = false;
    showStatus("Couldn't reach the world. Check your connection and try again.");
    syncAdvanceButton();
  }
});

async function poll() {
  if (state.source !== WORLD || document.hidden || state.requesting) return;
  try {
    const response = await fetch("api/world/status");
    if (!response.ok) return;
    const status: WorldStatus = await response.json();
    const grew = state.world && status.generations > state.world.generations;
    state.world = status;
    if (grew && state.era === undefined) await loadWorld({ grow: true, keepView: true });
    else syncWorldControls();
  } catch {
    // A missed poll is harmless; the next one catches up.
  }
}

function setMode(mode: Mode) {
  const toggles = [...document.querySelectorAll<HTMLButtonElement>(".segmented button")];
  toggles.forEach((toggle, index) => {
    const active = toggle.dataset.mode === mode;
    toggle.setAttribute("aria-selected", String(active));
    toggle.tabIndex = active ? 0 : -1;
    if (active) segmented.dataset.active = String(index);
  });
  rowTools.hidden = mode !== "rect";
  tree.setMode(mode);
}

function syncThemeToggle() {
  const dark = currentTheme() === "dark";
  themeToggle.innerHTML = dark ? ICONS.sun : ICONS.moon;
  themeToggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

for (const toggle of document.querySelectorAll<HTMLButtonElement>(".segmented button")) {
  toggle.addEventListener("click", () => setMode(toggle.dataset.mode as Mode));
}
segmented.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const next = segmented.querySelector<HTMLButtonElement>(`button[data-mode="${event.key === "ArrowLeft" ? "rect" : "radial"}"]`)!;
  setMode(next.dataset.mode as Mode);
  next.focus();
});

themeToggle.addEventListener("click", toggleTheme);
addEventListener("themechange", () => {
  syncThemeToggle();
  refresh();
});

$("#zoom-in").addEventListener("click", () => tree.zoom(1.4));
$("#zoom-out").addEventListener("click", () => tree.zoom(1 / 1.4));
$("#rows-out").addEventListener("click", () => tree.spreadRows(1.5));
$("#rows-in").addEventListener("click", () => tree.spreadRows(1 / 1.5));
$("#fit").addEventListener("click", () => tree.fit());
$("#cancel-pick").addEventListener("click", () => {
  state.picking = false;
  refresh();
});

search.addEventListener("change", () => {
  const id = search.value.trim();
  if (!state.layout?.byId.has(id)) return;
  tree.progress = state.layout.generations;
  setPlaying(false);
  syncTimeline();
  state.a = id;
  state.b = undefined;
  refresh();
  tree.focus([id]);
  search.value = "";
});

playButton.addEventListener("click", () => {
  if (!state.layout) return;
  if (!state.playing && tree.progress >= state.layout.generations) tree.progress = 0;
  setPlaying(!state.playing);
});

scrub.addEventListener("input", () => {
  setPlaying(false);
  tree.progress = Number(scrub.value);
  syncTimeline();
});

runSelect.addEventListener("change", () => {
  if (runSelect.value === WORLD) {
    state.era = undefined;
    void loadWorld();
  } else {
    void loadSaved(runSelect.value);
  }
});

eraSelect.addEventListener("change", () => {
  state.era = eraSelect.value === "" ? undefined : Number(eraSelect.value);
  void loadWorld();
});

addEventListener("keydown", (event: KeyboardEvent) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) return;
  if (event.key === "Escape") clearAll();
  else if (event.key === "f") tree.fit();
  else if (event.key === "+" || event.key === "=") tree.zoom(1.4);
  else if (event.key === "-") tree.zoom(1 / 1.4);
  else if (event.key === " ") {
    event.preventDefault();
    playButton.click();
  }
});

setPlaying(false);
syncThemeToggle();
requestAnimationFrame(tick);
setInterval(syncAdvanceButton, 1000);
setInterval(poll, POLL_MS);

const saved: string[] = await (await fetch("runs/index.json")).json();
const worldAvailable = await fetch("api/world/status")
  .then((response) => response.ok)
  .catch(() => false);
const sources = [
  ...(worldAvailable ? [new Option("Living world", WORLD)] : []),
  ...saved.map((name) => new Option(`Saved run · ${name.replace(/\.json$/, "")}`, name)),
];
runSelect.replaceChildren(...sources);
if (worldAvailable) await loadWorld();
else if (saved.length > 0) await loadSaved(saved[0]);
