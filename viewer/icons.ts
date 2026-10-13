// Hand-drawn 16-grid glyphs from the Opensource UI icon set (MIT, Bidyut Kundu).
const svg = (paths: string) =>
  `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const ICONS = {
  close: svg('<path d="M4 4l8 8M12 4l-8 8" />'),
  play: svg('<path d="M4.8 2.9 l7.7 5.1 L4.8 13.1 V2.9 z" />'),
  pause: svg('<path d="M5.9 2.6 v10.9 M10.1 2.6 v10.9" />'),
  sun: svg(
    '<circle cx="8" cy="8" r="3.5" /><path d="M8 1.4 v1.6 M8 13 v1.6 M1.4 8 h1.6 M13 8 h1.6 M3.3 3.3 l1.1 1.1 M11.5 11.5 l1.1 1.1 M11.5 4.5 l1.1 -1.1 M3.3 12.7 l1.1 -1.1" />',
  ),
  moon: svg('<path d="M13.8 9.7 A6.5 6.5 0 0 1 6.3 2.2 a6.5 6.5 0 1 0 7.5 7.5 z" />'),
};
