// Пиксельный холст сцены. Логика считается в клетках W×H, рисуется в буфер вдвое точнее (S мелких пикселей на клетку).
// Рисование идёт в «текущий» холст: кадр, неподвижный фон или спрайт — его выбирает setTarget().
// R и P рисуют в клетках, Q и q — в мелких пикселях (координаты удвоены).

export const W = 384, H = 216, S = 2;
export type Ctx = CanvasRenderingContext2D;

/** Холст размером со сцену: внутри координаты в клетках, без сглаживания. */
export function layer(w = W, h = H): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w * S; c.height = h * S;
  const x = c.getContext('2d')!;
  x.setTransform(S, 0, 0, S, 0, 0);
  x.imageSmoothingEnabled = false;
  return [c, x];
}

let cur: Ctx | null = null;
export const setTarget = (c: Ctx) => { cur = c; };
export const target = (): Ctx => cur!;

export const R = (x: number, y: number, w: number, h: number, c: string) => { cur!.fillStyle = c; cur!.fillRect(Math.round(x), Math.round(y), w, h); };
export const P = (x: number, y: number, c: string) => R(x, y, 1, 1, c);
export const Q = (x: number, y: number, w: number, h: number, c: string) => {
  cur!.fillStyle = c;
  cur!.fillRect(Math.round(x) / S, Math.round(y) / S, Math.round(w) / S, Math.round(h) / S);
};
export const q = (x: number, y: number, c: string) => Q(x, y, 1, 1, c);

/** Круг (эллипс при sy ≠ 1) из горизонтальных полос в мелких пикселях. */
export function discQ(cx: number, cy: number, r: number, c: string, sy = 1) {
  r = Math.round(r);
  for (let y = -r; y <= r; y++) {
    const hw = Math.floor(Math.sqrt(r * r + r * 0.6 - y * y));
    Q(cx - hw, cy + Math.round(y * sy), hw * 2 + 1, 1, c);
  }
}

export function lineQ(x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
  for (let i = 0; i <= n; i++) q(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
}

/** Мягкое свечение-эллипс в клетках (фонари, фары, неон); рисуется в текущий холст. */
export function glow(x: number, y: number, rx: number, ry: number, rgb: string, a: number) {
  const g = cur!, gr = g.createRadialGradient(x, y, 0, x, y, rx);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
  g.fillStyle = gr; g.fillRect(x - rx, y - rx, rx * 2, rx * 2); g.restore();
}
