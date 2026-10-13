import type { Base } from "./genome";

export type Theme = "light" | "dark";

export type Palette = {
  canvas: string;
  axis: string;
  axisBorder: string;
  axisText: string;
  grid: string;
  label: string;
  faint: string;
  deadBranch: number[];
  deadFill: string;
  nodeRing: string;
  hoverRing: string;
  spared: string;
  ancestry: string;
  mrca: string;
  mrcaText: string;
  bands: Record<string, string>;
  inks: Record<string, string>;
  helixBack: string;
  helixAccent: string;
  helixHover: string;
  mismatch: string;
  mismatchText: string;
  bases: Record<Base, string>;
};

const LIGHT: Palette = {
  canvas: "#fafafa",
  axis: "#ffffff",
  axisBorder: "#e5e5e5",
  axisText: "#737373",
  grid: "rgba(0, 0, 0, 0.05)",
  label: "#262626",
  faint: "#a3a3a3",
  deadBranch: [163, 163, 163],
  deadFill: "#ffffff",
  nodeRing: "#ffffff",
  hoverRing: "#171717",
  spared: "#ca8a04",
  ancestry: "rgba(37, 99, 235, 0.75)",
  mrca: "#171717",
  mrcaText: "#ffffff",
  bands: { tidepools: "#e6f2ee", deepOcean: "#e6edf5", desert: "#f9ede0", iceAge: "#e9f2fb", rainforest: "#eaf3e2" },
  inks: { tidepools: "#0f766e", deepOcean: "#1e40af", desert: "#c2410c", iceAge: "#0369a1", rainforest: "#15803d" },
  helixBack: "#d4d4d4",
  helixAccent: "#404040",
  helixHover: "rgba(0, 0, 0, 0.05)",
  mismatch: "rgba(244, 63, 94, 0.1)",
  mismatchText: "#e11d48",
  bases: { A: "#16a34a", C: "#2563eb", G: "#d97706", T: "#dc2626" },
};

const DARK: Palette = {
  canvas: "#0a0a0a",
  axis: "#111111",
  axisBorder: "#262626",
  axisText: "#a3a3a3",
  grid: "rgba(255, 255, 255, 0.05)",
  label: "#d4d4d4",
  faint: "#737373",
  deadBranch: [115, 115, 115],
  deadFill: "#0a0a0a",
  nodeRing: "#0a0a0a",
  hoverRing: "#ededed",
  spared: "#facc15",
  ancestry: "rgba(96, 165, 250, 0.85)",
  mrca: "#ededed",
  mrcaText: "#0a0a0a",
  bands: { tidepools: "#0c1a17", deepOcean: "#0d1320", desert: "#1c140c", iceAge: "#0c1620", rainforest: "#0d1a0e" },
  inks: { tidepools: "#5eead4", deepOcean: "#93c5fd", desert: "#fdba74", iceAge: "#7dd3fc", rainforest: "#86efac" },
  helixBack: "#404040",
  helixAccent: "#d4d4d4",
  helixHover: "rgba(255, 255, 255, 0.06)",
  mismatch: "rgba(244, 63, 94, 0.16)",
  mismatchText: "#fb7185",
  bases: { A: "#4ade80", C: "#60a5fa", G: "#fbbf24", T: "#f87171" },
};

const STORAGE_KEY = "jev-evolution-theme";
const media = matchMedia("(prefers-color-scheme: dark)");

function stored(): Theme | undefined {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function currentTheme(): Theme {
  return stored() ?? (media.matches ? "dark" : "light");
}

let palette = currentTheme() === "dark" ? DARK : LIGHT;

export function colors(): Palette {
  return palette;
}

function apply() {
  const theme = currentTheme();
  palette = theme === "dark" ? DARK : LIGHT;
  const explicit = stored();
  if (explicit) document.documentElement.dataset.theme = explicit;
  else delete document.documentElement.dataset.theme;
  dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

export function toggleTheme() {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  try {
    if (next === (media.matches ? "dark" : "light")) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage can be blocked; the theme still applies for this visit.
  }
  apply();
}

media.addEventListener("change", apply);
