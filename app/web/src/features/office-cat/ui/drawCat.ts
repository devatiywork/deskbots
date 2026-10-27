// Рисование кота, летящей вкусняшки и сердечек (мелкие пиксели, в текущий холст кадра).
import { Q, S, discQ, q } from '@/shared/lib/pixel/canvas';
import { presence } from '@/entities/world';
import { cat } from '../model/cat';

const CAT = { base: '#e0915f', dark: '#c97a4c', light: '#f6c79a', ol: '#7a3f22' };

export function drawCat(t: number) {
  if (presence.catOnVacuum) return;                          // сидит на пылесосе: его рисует пылесос
  const X = Math.round(cat.x * S), Y = Math.round(cat.y * S), walking = cat.path.length > 0;
  const lying = !walking && (cat.mode === 'sleep' || cat.mode === 'sofa');
  if (lying) {
    // свернулся клубком, хвост шевелится
    discQ(X + 2, Y, 7, CAT.dark, 0.6); discQ(X + 2, Y - 1, 6, CAT.base, 0.6); q(X, Y - 3, CAT.dark); q(X + 4, Y - 3, CAT.dark); q(X + 2, Y - 4, CAT.dark); q(X + 6, Y - 1, CAT.dark);
    discQ(X - 7, Y - 1, 4, CAT.base); q(X - 10, Y - 5, CAT.base); q(X - 4, Y - 5, CAT.base);
    const awake = cat.mode === 'sofa' && t % 5 < 2.2;
    if (awake) { q(X - 9, Y - 2, '#3d8a4c'); q(X - 5, Y - 2, '#3d8a4c'); } else { Q(X - 9, Y - 1, 2, 1, '#1D1A33'); Q(X - 5, Y - 1, 1, 1, '#1D1A33'); }
    q(X - 7, Y + 1, '#ff9ab8');
    Q(X + 9, Y + 1 + Math.round(Math.sin(t * 2) * 1.5), 6, 2, CAT.dark);
    return;
  }
  // c() рисует, отражая по направлению взгляда
  const f = cat.dir === 'right' ? 1 : -1;
  const c = (dx: number, dy: number, w: number, h: number, col: string) => Q(f > 0 ? X + dx : X - dx - w + 1, Y + dy, w, h, col);
  Q(X - 7, Y - 1, 15, 2, 'rgba(0,0,0,0.22)');
  if (walking) {
    const st = ((cat.ph * (cat.speed > 25 ? 14 : 9)) | 0) % 2;
    for (const [lx, ph] of [[-5, 0], [-3, 1], [2, 1], [4, 0]]) c(lx, -3 - (st === ph ? 1 : 0), 1, 3, CAT.dark);
    c(-6, -8, 12, 6, CAT.ol); c(-5, -8, 10, 5, CAT.base); c(-5, -8, 10, 1, CAT.light); c(-4, -4, 8, 1, CAT.light);
    c(-3, -7, 1, 3, CAT.dark); c(0, -7, 1, 3, CAT.dark);
    c(4, -12, 6, 6, CAT.ol); c(4, -11, 5, 5, CAT.base); c(4, -13, 1, 2, CAT.base); c(7, -13, 1, 2, CAT.base);
    c(7, -10, 1, 1, '#2f6e3d'); c(9, -8, 1, 1, '#ff9ab8');
    const tw = Math.round(Math.sin(t * 6) * 1.5);
    c(-8, -9, 2, 1, CAT.dark); c(-9, -11 + tw, 1, 3, CAT.dark); c(-10, -12 + tw, 1, 1, CAT.dark);
    return;
  }
  // сидит: мордочкой к агенту, хвост обвит вокруг лап
  c(-4, -8, 9, 8, CAT.ol); c(-3, -8, 7, 7, CAT.base); c(-1, -5, 3, 4, CAT.light); c(-3, -1, 7, 1, CAT.dark);
  c(-3, -14, 8, 7, CAT.ol); c(-2, -14, 7, 6, CAT.base); c(-3, -16, 2, 2, CAT.base); c(3, -16, 2, 2, CAT.base);
  q(f > 0 ? X - 2 : X + 2, Y - 15, '#ff9ab8'); q(f > 0 ? X + 4 : X - 4, Y - 15, '#ff9ab8');
  const blink = t % 3.3 < 0.15;
  c(0, -12, 1, blink ? 1 : 2, blink ? CAT.dark : '#2f6e3d'); c(3, -12, 1, blink ? 1 : 2, blink ? CAT.dark : '#2f6e3d'); c(2, -10, 1, 1, '#ff9ab8');
  c(-1, -11, 1, 1, CAT.dark);
  const sw = Math.round(Math.sin(t * 2.5) * 1.2);
  c(-7, -2 + sw, 4, 1, CAT.dark); c(-8, -4 + sw, 1, 3, CAT.dark);
}

/** Вкусняшка: летит дугой от агента к коту, потом уменьшается, пока кот ест. */
export function drawTreat(t: number) {
  const tz = cat.toss;
  if (!tz || t < tz.t0) return;
  let x = tz.x1, y = tz.y1, k = 1;
  if (!tz.eat) { const p = Math.min(1, (t - tz.t0) / 0.7); x = tz.x0 + (tz.x1 - tz.x0) * p; y = tz.y0 + (tz.y1 - tz.y0) * p - Math.sin(p * Math.PI) * 10; }
  else k = Math.max(0, 1 - (t - tz.eat) / 2.6);
  const X = Math.round(x * S), Y = Math.round(y * S), w = Math.max(1, Math.round(5 * k));
  Q(X - 2, Y, w, 3, '#8a5f3f'); Q(X - 2, Y, w, 1, '#d9a066');
  if (k > 0.6) { q(X + 3, Y - 1, '#8a5f3f'); q(X + 3, Y + 2, '#8a5f3f'); }
}

const H5 = ['.#.#.', '#####', '.###.', '..#..'];
/** Сердечки над котом: всплывают и тают. */
export function drawHearts() {
  for (const h of cat.hearts) {
    const X = Math.round(h.x * S), Y = Math.round(h.y * S), a = Math.min(1, h.life / 0.5);
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 5; xx++) if (H5[yy][xx] === '#') q(X + xx - 2, Y + yy, `rgba(255,110,150,${a.toFixed(2)})`);
  }
}
