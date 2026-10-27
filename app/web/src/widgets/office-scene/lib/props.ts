// Мебель и растения в мелких пикселях: ящик, растения в кадках, лиана, цветочный ящик, доски пола, луна.
// Рисуют в текущий холст (setTarget); r — генератор с зерном, чтобы фон каждый раз выходил одинаковым.
import { Q, discQ, q } from '@/shared/lib/pixel/canvas';
import { shade } from '@/shared/lib/color';
import { env, moonAge } from '@/entities/environment';

export type Rnd = () => number;

export function boxQ(x: number, y: number, w: number, h: number, c: string, edge = shade(c, 0.42)) {
  Q(x - 1, y - 1, w + 2, h + 2, edge); Q(x, y, w, h, c); Q(x, y, w, 1, shade(c, 1.16));
}

/** Большое растение в кадке: веер из длинных листьев, концы клонятся вниз. */
export function bigPlantQ(cx: number, by: number, h: number, r: Rnd, pot = '#eeeaf6') {
  Q(cx - 7, by - 12, 15, 12, shade(pot, 0.45)); Q(cx - 6, by - 11, 13, 10, pot); Q(cx + 3, by - 10, 2, 8, shade(pot, 0.88));
  Q(cx - 7, by - 14, 15, 3, shade(pot, 0.7)); Q(cx - 6, by - 14, 13, 1, shade(pot, 1.06)); Q(cx - 5, by - 13, 11, 1, '#4a3424');
  const n = 9;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.3 + (r() - 0.5) * 0.2, L = h * (0.6 + r() * 0.4);
    for (let i = 2; i <= L; i++) {
      const fall = (i / L) ** 2 * Math.abs(Math.cos(a)) * h * 0.3;
      const x = cx + Math.cos(a) * i, y = by - 14 + Math.sin(a) * i + fall;
      const w = Math.max(0, Math.round(Math.sin((Math.PI * i) / L) * 2.2));
      Q(x - w / 2, y - w / 2, w + 1, w + 1, i > L * 0.6 ? '#4fb060' : '#2f8a4a');
      if (w > 1) q(x, y - 1, '#7fd88a');
    }
  }
}

/** Цветок в горшке; bloom — цвет бутонов (весной). */
export function potQ(cx: number, by: number, pot = '#eeeaf6', bloom?: string | null) {
  Q(cx - 4, by - 6, 9, 6, shade(pot, 0.5)); Q(cx - 3, by - 6, 7, 5, pot); Q(cx - 4, by - 7, 9, 2, shade(pot, 1.08));
  discQ(cx - 2, by - 10, 3, '#2a7a40'); discQ(cx + 2, by - 10, 3, '#2f8a4a'); discQ(cx, by - 12, 3, '#3f9f58');
  q(cx - 1, by - 14, '#7fd88a'); q(cx + 2, by - 12, '#58b86a'); q(cx - 3, by - 10, '#58b86a');
  if (bloom) { q(cx - 2, by - 12, bloom); q(cx + 2, by - 13, bloom); q(cx + 1, by - 9, bloom); }
}

/** Лиана свисает со стены. */
export function vineQ(x: number, y0: number, len: number, r: Rnd) {
  for (let i = 0; i < len; i++) {
    const x1 = x + Math.round(Math.sin(i * 0.45 + x) * 2);
    q(x1, y0 + i, '#2f7a45');
    if (i % 3 === 1) Q(x1 + (i % 6 === 1 ? 1 : -2), y0 + i, 2, 2, r() < 0.5 ? '#58b86a' : '#3f9f58');
  }
}

/** Цветочный ящик у входа: осенью оранжевые цветы, зимой снег. */
export function planterQ(x: number, y: number, w: number, _r: Rnd) {
  Q(x - 1, y + 5, w + 2, 10, '#3a2416'); Q(x, y + 6, w, 8, '#9a6a44'); Q(x, y + 6, w, 1, '#c09068'); Q(x, y + 10, w, 1, '#7a5236');
  for (let i = 0; i < w - 2; i += 4) discQ(x + 2 + i, y + 4, 3, i % 8 ? '#2f7a45' : '#357d44');
  for (let i = 1; i < w - 1; i += 3) {
    const c = env.season === 'autumn' ? '#ffb347' : env.season === 'winter' ? '#f4f7fd' : i % 2 ? '#ff9ab8' : '#ffd6e6';
    q(x + i, y + 1 + ((i * 7) % 4), c);
  }
}

/** Пол из досок: ряды по 8 мелких пикселей, доски разной длины и чуть разного тона, швы и волокна. */
export function planks(x0: number, x1: number, y0: number, y1: number, base: string, seam: string, r: Rnd) {
  for (let y = y0, row = 0; y < y1; y += 8, row++) {
    const h = Math.min(8, y1 - y);
    let x = x0 - ((row * 37) % 60);
    while (x < x1) {
      const len = 46 + ((r() * 40) | 0), xs = Math.max(x, x0), xe = Math.min(x + len, x1), k = 0.94 + r() * 0.1, c = shade(base, k);
      Q(xs, y, xe - xs, h, c); Q(xs, y, xe - xs, 1, shade(base, k * 1.07));
      if (h === 8) Q(xs, y + 7, xe - xs, 1, seam);
      if (x + len < x1) Q(x + len - 1, y, 1, h, seam);
      for (let i = 0; i < len / 16; i++) { const gx = xs + r() * Math.max(1, xe - xs - 7); Q(gx, y + 2 + ((r() * 4) | 0), 3 + ((r() * 5) | 0), 1, shade(c, 0.9)); }
      x += len;
    }
  }
}

/** Луна в нужной фазе: освещённая часть справа растёт к полнолунию, потом убывает слева. */
export function drawMoonQ(cx: number, cy: number, r: number, dark: string) {
  const p = moonAge(), c = Math.cos(2 * Math.PI * p);
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r + r * 0.6 - y * y)));
    for (let x = -w; x <= w; x++) { const nx = (x + 0.5) / (w + 0.5); q(cx + x, cy + y, (p < 0.5 ? nx > c : nx < -c) ? '#fff6d8' : dark); }
  }
}
