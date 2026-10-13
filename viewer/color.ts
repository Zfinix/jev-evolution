const VENT = [8, 145, 178];
const MIDDLE = [120, 113, 108];
const DESERT = [234, 88, 12];

export const SLOT_COLORS = { a: "#2563eb", b: "#db2777" };

export function lineageRgb(ventShare: number): number[] {
  const t = 1 - ventShare;
  const [from, to, local] = t < 0.5 ? [VENT, MIDDLE, t * 2] : [MIDDLE, DESERT, (t - 0.5) * 2];
  return from.map((channel, i) => Math.round(channel + (to[i] - channel) * local));
}

export function rgba(rgb: number[], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}
