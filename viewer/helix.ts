import { COMPLEMENT, LOCUS_LENGTH, type Base, type Locus } from "./genome";
import { colors } from "./theme";

const BASES_PER_TURN = 10.5;
const PAD = 14;
const TICKS = 16;

export type HelixOptions = {
  loci: Locus[];
  accent?: string;
  mismatched?: Set<number>;
  height?: number;
};

// A B-form style double helix: one rung per base pair, the second strand is the complement.
export function createHelix({ loci, accent, mismatched = new Set(), height = 92 }: HelixOptions): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "helix";
  const canvas = document.createElement("canvas");
  canvas.style.height = `${height}px`;
  const caption = document.createElement("div");
  caption.className = "helix-caption";
  const idle = `${loci.length} loci · ${loci.length * LOCUS_LENGTH} bp · hover to read a locus`;
  caption.textContent = idle;
  wrapper.append(canvas, caption);

  const bases = loci.flatMap((locus) => [...locus.sequence] as Base[]);
  let hoveredLocus = -1;
  let attached = false;

  const geometry = () => {
    const width = canvas.clientWidth;
    const step = (width - PAD * 2) / Math.max(1, bases.length - 1);
    return { width, step };
  };

  canvas.addEventListener("mousemove", (event) => {
    const { step } = geometry();
    const x = event.clientX - canvas.getBoundingClientRect().left;
    const index = Math.round((x - PAD) / step);
    const locus = Math.floor(index / LOCUS_LENGTH);
    hoveredLocus = locus >= 0 && locus < loci.length ? locus : -1;
    if (hoveredLocus < 0) {
      caption.textContent = idle;
      return;
    }
    const { trait, value, sequence } = loci[hoveredLocus];
    const note = mismatched.has(hoveredLocus) ? " · differs" : "";
    caption.textContent = `Locus ${hoveredLocus + 1} · ${trait}: ${value} · ${sequence}${note}`;
  });
  canvas.addEventListener("mouseleave", () => {
    hoveredLocus = -1;
    caption.textContent = idle;
  });

  const draw = (now: number) => {
    if (canvas.isConnected) attached = true;
    else if (attached) return;
    requestAnimationFrame(draw);
    const { width, step } = geometry();
    if (width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    const ctx = canvas.getContext("2d")!;
    const palette = colors();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const axis = (height - TICKS) / 2;
    const amplitude = axis - 8;
    const spin = now / 1600;
    const phase = (i: number, strand: number) => (i / BASES_PER_TURN) * Math.PI * 2 + spin + strand * Math.PI * 0.78;
    const locusSpan = (locus: number) => [PAD + (locus * LOCUS_LENGTH - 0.5) * step, LOCUS_LENGTH * step] as const;

    for (const locus of mismatched) {
      const [x, w] = locusSpan(locus);
      ctx.fillStyle = palette.mismatch;
      ctx.fillRect(x, 0, w, height - TICKS);
    }
    if (hoveredLocus >= 0) {
      const [x, w] = locusSpan(hoveredLocus);
      ctx.fillStyle = palette.helixHover;
      ctx.fillRect(x, 0, w, height - TICKS);
    }

    const strandY = (i: number, strand: number) => axis + Math.sin(phase(i, strand)) * amplitude;
    const depth = (i: number, strand: number) => Math.cos(phase(i, strand));

    const backbone = (front: boolean) => {
      for (const strand of [0, 1]) {
        for (let i = 0; i < bases.length - 1; i++) {
          const z = (depth(i, strand) + depth(i + 1, strand)) / 2;
          if (z >= 0 !== front) continue;
          ctx.strokeStyle = front ? (accent ?? palette.helixAccent) : palette.helixBack;
          ctx.lineWidth = front ? 2.4 : 1.5;
          ctx.beginPath();
          ctx.moveTo(PAD + i * step, strandY(i, strand));
          ctx.lineTo(PAD + (i + 1) * step, strandY(i + 1, strand));
          ctx.stroke();
        }
      }
    };

    backbone(false);
    ctx.lineWidth = Math.max(1, Math.min(3, step * 0.6));
    bases.forEach((base, i) => {
      const x = PAD + i * step;
      const y0 = strandY(i, 0);
      const y1 = strandY(i, 1);
      const middle = (y0 + y1) / 2;
      ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(phase(i, 0)));
      ctx.strokeStyle = palette.bases[base];
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, middle);
      ctx.stroke();
      ctx.strokeStyle = palette.bases[COMPLEMENT[base]];
      ctx.beginPath();
      ctx.moveTo(x, middle);
      ctx.lineTo(x, y1);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    backbone(true);

    ctx.strokeStyle = palette.helixBack;
    ctx.lineWidth = 1;
    ctx.font = "9px 'Geist Mono', ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    const labelEvery = LOCUS_LENGTH * step >= 16 ? 1 : 4;
    for (let locus = 0; locus <= loci.length; locus++) {
      const x = PAD + (locus * LOCUS_LENGTH - 0.5) * step;
      ctx.beginPath();
      ctx.moveTo(x, height - TICKS);
      ctx.lineTo(x, height - TICKS + 4);
      ctx.stroke();
      if (locus < loci.length && locus % labelEvery === 0) {
        ctx.fillStyle = mismatched.has(locus) ? palette.mismatchText : palette.faint;
        ctx.fillText(String(locus + 1), x + (LOCUS_LENGTH * step) / 2, height - 2);
      }
    }
  };
  requestAnimationFrame(draw);
  return wrapper;
}
