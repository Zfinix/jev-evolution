type Dna = Record<string, string>;

const TEMPERATURE_HUE: Record<string, number> = {
  "cold-adapted": 195,
  "cool-tolerant": 175,
  neutral: 110,
  "heat-tolerant": 38,
  "heat-loving": 18,
};

const SIZE_SCALE: Record<string, number> = { tiny: 0.5, small: 0.66, medium: 0.8, large: 0.92, huge: 1 };

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function random(seed: number) {
  let state = seed;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507) + 0x9e3779b9;
    state = (state ^ (state >>> 13)) >>> 0;
    return state / 4294967296;
  };
}

// Draws a creature whose body, limbs, surface and senses all come straight from its genes.
export function drawCreature(ctx: CanvasRenderingContext2D, dna: Dna, id: string, cx: number, cy: number, size: number) {
  const rand = random(hash(id));
  const hue = TEMPERATURE_HUE[dna.temperature] ?? 110;
  const glows = dna.light === "bioluminescent";
  const body = size * 0.3 * (SIZE_SCALE[dna.size] ?? 0.8);
  const stretch = dna.speed === "sprinter" || dna.speed === "quick" ? 1.35 : dna.speed === "sluggish" ? 0.9 : 1.1;
  const rx = body * stretch;
  const ry = body;
  const lightness = glows || dna.light === "dark-dwelling" ? 28 : dna.light === "sun-basking" ? 52 : 42;
  const skin = `hsl(${hue} 55% ${lightness}%)`;
  const shade = `hsl(${hue} 50% ${lightness - 14}%)`;
  const accent = glows ? `hsl(${(hue + 150) % 360} 100% 70%)` : `hsl(${(hue + 30) % 360} 80% 62%)`;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (glows) {
    const halo = ctx.createRadialGradient(0, 0, body * 0.5, 0, 0, body * 2.4);
    halo.addColorStop(0, `hsla(${(hue + 150) % 360} 100% 60% / 0.28)`);
    halo.addColorStop(1, "transparent");
    ctx.fillStyle = halo;
    ctx.fillRect(-size / 2, -size / 2, size, size);
  }

  drawLimbs(ctx, dna.limbs, rx, ry, shade, accent, rand);
  if (dna.locomotion === "gliding" && dna.limbs !== "two legs and wings") drawWings(ctx, rx, ry, shade, 0.7);

  if (dna.defense === "spines") {
    ctx.strokeStyle = `hsl(${hue} 30% 78%)`;
    ctx.lineWidth = Math.max(1, body * 0.06);
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + (i / 13) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rx * 0.9, Math.sin(a) * ry * 0.9);
      ctx.lineTo(Math.cos(a) * rx * 1.45, Math.sin(a) * ry * 1.45);
      ctx.stroke();
    }
  }

  if (dna.defense === "shell retreat") {
    ctx.fillStyle = `hsl(${hue} 25% 60%)`;
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.15, rx * 1.12, ry * 1.08, 0, Math.PI, 0);
    ctx.fill();
  }

  const gradient = ctx.createRadialGradient(-rx * 0.3, -ry * 0.4, body * 0.1, 0, 0, rx);
  gradient.addColorStop(0, `hsl(${hue} 60% ${lightness + 16}%)`);
  gradient.addColorStop(1, skin);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  if (dna.covering === "slime coat" || dna.covering === "soft skin") {
    const wobble = dna.covering === "slime coat" ? 0.08 : 0.03;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = 1 + Math.sin(a * 5 + rand() * 0.3) * wobble;
      const x = Math.cos(a) * rx * r;
      const y = Math.sin(a) * ry * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
  } else {
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  drawCovering(ctx, dna.covering, rx, ry, body, hue, lightness, rand);

  if (dna.defense === "toxins") {
    ctx.fillStyle = glows ? accent : "hsl(60 100% 60%)";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc((rand() - 0.5) * rx * 1.2, (rand() - 0.2) * ry * 0.9, body * (0.06 + rand() * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (dna.defense === "camouflage") {
    ctx.fillStyle = `hsla(${hue} 30% 20% / 0.45)`;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.ellipse((rand() - 0.5) * rx * 1.4, (rand() - 0.5) * ry * 1.2, body * 0.18, body * 0.1, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (glows) {
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = body * 0.5;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * rx * 0.72, Math.sin(a) * ry * 0.72, body * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  drawHead(ctx, dna, rx, ry, body, accent);
  ctx.restore();
}

function drawLimbs(
  ctx: CanvasRenderingContext2D,
  limbs: string,
  rx: number,
  ry: number,
  color: string,
  accent: string,
  rand: () => number,
) {
  ctx.strokeStyle = color;
  if (limbs === "tentacles") {
    ctx.lineWidth = ry * 0.14;
    for (let i = 0; i < 6; i++) {
      const x = -rx * 0.7 + (i / 5) * rx * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, ry * 0.6);
      const sway = (rand() - 0.5) * rx * 0.8;
      ctx.bezierCurveTo(x + sway, ry * 1.3, x - sway, ry * 1.7, x + sway * 0.6, ry * 2.1);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x + sway * 0.6, ry * 2.1, ry * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (limbs === "many small legs") {
    ctx.lineWidth = ry * 0.07;
    for (let i = 0; i < 10; i++) {
      const x = -rx * 0.85 + (i / 9) * rx * 1.7;
      ctx.beginPath();
      ctx.moveTo(x, ry * 0.7);
      ctx.lineTo(x + (i % 2 ? 1 : -1) * rx * 0.1, ry * 1.25);
      ctx.stroke();
    }
  } else if (limbs === "four legs" || limbs === "two legs and wings") {
    const legs = limbs === "four legs" ? [-0.6, -0.25, 0.25, 0.6] : [-0.3, 0.3];
    ctx.lineWidth = ry * 0.16;
    for (const offset of legs) {
      const x = offset * rx;
      ctx.beginPath();
      ctx.moveTo(x, ry * 0.5);
      ctx.lineTo(x + rx * 0.12, ry * 1.05);
      ctx.lineTo(x - rx * 0.02, ry * 1.5);
      ctx.stroke();
    }
    if (limbs === "two legs and wings") drawWings(ctx, rx, ry, color, 1);
  }
}

function drawWings(ctx: CanvasRenderingContext2D, rx: number, ry: number, color: string, scale: number) {
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * rx * 0.2, -ry * 0.3);
    ctx.quadraticCurveTo(side * rx * 1.4 * scale, -ry * 2.2 * scale, side * rx * 2 * scale, -ry * 0.9 * scale);
    ctx.quadraticCurveTo(side * rx * 1.1 * scale, -ry * 0.6, side * rx * 0.3, ry * 0.1);
    ctx.fill();
  }
}

function drawCovering(
  ctx: CanvasRenderingContext2D,
  covering: string,
  rx: number,
  ry: number,
  body: number,
  hue: number,
  lightness: number,
  rand: () => number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  if (covering === "bony armor plates") {
    ctx.strokeStyle = `hsl(${hue} 20% ${lightness - 20}%)`;
    ctx.lineWidth = body * 0.05;
    for (let i = 1; i < 6; i++) {
      const x = -rx + (i / 6) * rx * 2;
      ctx.beginPath();
      ctx.moveTo(x, -ry);
      ctx.quadraticCurveTo(x + rx * 0.12, 0, x, ry);
      ctx.stroke();
    }
  } else if (covering === "scales") {
    ctx.strokeStyle = `hsla(${hue} 30% ${lightness + 25}% / 0.5)`;
    ctx.lineWidth = body * 0.025;
    const step = body * 0.2;
    for (let y = -ry; y < ry; y += step * 0.7) {
      for (let x = -rx; x < rx; x += step) {
        ctx.beginPath();
        ctx.arc(x + (Math.round(y / step) % 2) * step * 0.5, y, step * 0.5, 0, Math.PI);
        ctx.stroke();
      }
    }
  } else if (covering === "fur") {
    ctx.strokeStyle = `hsla(${hue} 35% ${lightness + 20}% / 0.55)`;
    ctx.lineWidth = body * 0.03;
    for (let i = 0; i < 90; i++) {
      const x = (rand() - 0.5) * rx * 2;
      const y = (rand() - 0.5) * ry * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + body * 0.06, y + body * 0.14);
      ctx.stroke();
    }
  } else if (covering === "feathers") {
    ctx.fillStyle = `hsla(${hue} 40% ${lightness + 18}% / 0.5)`;
    for (let row = 0; row < 5; row++) {
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.ellipse(-rx + (i + row * 0.5) * rx * 0.4, -ry + row * ry * 0.45, body * 0.16, body * 0.08, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (covering === "slime coat") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.beginPath();
    ctx.ellipse(-rx * 0.35, -ry * 0.45, rx * 0.3, ry * 0.14, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, dna: Dna, rx: number, ry: number, body: number, accent: string) {
  const headX = rx * 0.62;
  const headY = -ry * 0.2;
  const brainy = dna.intelligence === "tool user" || dna.intelligence === "problem solver";

  if (dna.senses === "electroreception") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = body * 0.04;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(headX, headY - ry * 0.4);
      ctx.quadraticCurveTo(headX + side * rx * 0.3, -ry * 1.5, headX + side * rx * 0.45, -ry * 1.7);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(headX + side * rx * 0.45, -ry * 1.7, body * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (dna.senses === "pressure sensing") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = body * 0.03;
    ctx.setLineDash([body * 0.06, body * 0.08]);
    ctx.beginPath();
    ctx.moveTo(-rx * 0.85, 0);
    ctx.quadraticCurveTo(0, -ry * 0.25, rx * 0.85, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (dna.senses === "hearing") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(headX + side * rx * 0.25, headY - ry * 0.85, body * 0.1, body * 0.26, side * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const eyeSize = body * (dna.senses === "keen eyesight" ? 0.2 : dna.light === "dark-dwelling" ? 0.06 : 0.12);
  if (dna.senses !== "pressure sensing") {
    for (const offset of [-1, 1]) {
      const x = headX + offset * body * 0.22;
      ctx.fillStyle = "#f4f4f4";
      ctx.beginPath();
      ctx.arc(x, headY, eyeSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath();
      ctx.arc(x + eyeSize * 0.25, headY, eyeSize * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (brainy) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = body * 0.03;
    ctx.beginPath();
    ctx.arc(headX, headY - ry * 0.1, body * 0.42, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  if (dna.diet === "predator" || dna.defense === "bite") {
    ctx.fillStyle = "#f4f4f4";
    for (let i = 0; i < 4; i++) {
      const x = headX - body * 0.2 + i * body * 0.13;
      ctx.beginPath();
      ctx.moveTo(x, ry * 0.3);
      ctx.lineTo(x + body * 0.05, ry * 0.5);
      ctx.lineTo(x + body * 0.1, ry * 0.3);
      ctx.fill();
    }
  } else if (dna.diet === "filter feeder") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = body * 0.03;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(headX - body * 0.15 + i * body * 0.1, ry * 0.25);
      ctx.lineTo(headX - body * 0.15 + i * body * 0.1, ry * 0.45);
      ctx.stroke();
    }
  }
}
