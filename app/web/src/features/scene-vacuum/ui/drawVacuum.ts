// Робот-пылесос и его база у нижней стены (мелкие пиксели, в текущий холст кадра).
// В кадре по глубине: пылесос — vacuumDepthY(), база (и пылесос на ней) — DOCK_DEPTH_Y.
import { Q, S, discQ, q } from '@/shared/lib/pixel/canvas';
import { presence } from '@/entities/world';
import { DOCK, vacuumNow } from '../model/vacuum';

/** глубина базы: она у самой стены, впереди стоящего на ней пылесоса */
export const DOCK_DEPTH_Y = DOCK.y + 6;

const BODY = { rim: '#141220', side: '#2b2838', top: '#3d3a52', hi: '#5a5670', bump: '#a9b0c4' };
const CAT = { base: '#e0915f', dark: '#c97a4c', light: '#f6c79a', ol: '#7a3f22' };

/** Мурчик сидит на крыше пылесоса (пока он там, сам кот не рисуется); f — куда повёрнут (1 вправо, -1 влево). */
function rider(X: number, Y: number, f: number, t: number) {
  const c = (dx: number, dy: number, w: number, h: number, col: string) => Q(f > 0 ? X + dx : X - dx - w + 1, Y + dy, w, h, col);
  c(-4, -8, 9, 8, CAT.ol); c(-3, -8, 7, 7, CAT.base); c(-1, -5, 3, 4, CAT.light); c(-3, -1, 7, 1, CAT.dark);                // туловище
  c(-3, -14, 8, 7, CAT.ol); c(-2, -14, 7, 6, CAT.base); c(-3, -16, 2, 2, CAT.base); c(3, -16, 2, 2, CAT.base);             // голова и уши
  q(f > 0 ? X - 2 : X + 2, Y - 15, '#ff9ab8'); q(f > 0 ? X + 4 : X - 4, Y - 15, '#ff9ab8');
  c(0, -12, 1, 2, '#2f6e3d'); c(3, -12, 1, 2, '#2f6e3d'); c(2, -10, 1, 1, '#ff9ab8');
  const sw = Math.round(Math.sin(t * 2.5) * 1.2);
  c(-7, -2 + sw, 4, 1, CAT.dark); c(-8, -4 + sw, 1, 3, CAT.dark);                                                         // хвост свисает с края
}

/** Пылесос в точке (X, Y) мелких пикселей, бампером по углу ang; out — в пути (мигает, щётка крутится). */
function body(X: number, Y: number, ang: number, t: number, out: boolean, cat: boolean) {
  discQ(X, Y + 1, 6, 'rgba(0,0,0,0.22)', 0.5);                                                       // тень
  discQ(X, Y - 1, 6, BODY.rim, 0.55); discQ(X, Y - 2, 5, BODY.side, 0.55); discQ(X, Y - 3, 4, BODY.top, 0.5);
  Q(X - 2, Y - 5, 3, 1, BODY.hi);                                                                     // блик
  // бампер — светлая дуга спереди
  for (let k = -5; k <= 5; k++) { const a = ang + k * 0.22; q(X + Math.round(Math.cos(a) * 6), Y - 1 + Math.round(Math.sin(a) * 3.3), BODY.bump); }
  // боковая щётка крутится у переднего края
  if (out) {
    const a = ang + 0.9, bx = X + Math.round(Math.cos(a) * 6), by = Y + Math.round(Math.sin(a) * 3.3), r = t * 18;
    q(bx + Math.round(Math.cos(r) * 1.5), by + Math.round(Math.sin(r)), '#d8d0f0'); q(bx, by, '#6c7388');
  }
  // огонёк: в пути мигает голубым, на базе горит зелёным
  q(X, Y - 3, out ? (((t * 3) | 0) % 2 ? '#5cc8ff' : '#2a6a9a') : '#7fe0b4');
  if (cat) rider(X, Y - 3, Math.cos(ang) >= 0 ? 1 : -1, t);
}

/** Пылесос в пути; на базе его рисует drawDock. После столкновения чуть дрожит. */
export function drawVacuum(t: number) {
  const v = vacuumNow();
  if (!v) return;
  const shake = t < v.pause && ((t * 20) | 0) % 2 ? 1 : 0;
  body(Math.round(v.x * S) + shake, Math.round(v.y * S), v.ang, t, true, presence.catOnVacuum);
}

/** База у нижней стены: тумба с огоньком; пока пылесос дома, он стоит перед ней и заряжается. */
export function drawDock(t: number) {
  const X = DOCK.x * S, Y = DOCK.y * S, out = !!vacuumNow();
  if (!out) body(X, Y, Math.PI / 2, t, false, presence.catOnVacuum);
  Q(X - 7, Y + 4, 14, 10, '#6c7388'); Q(X - 6, Y + 5, 12, 9, '#cfd3e0'); Q(X - 6, Y + 5, 12, 1, '#eef0f6'); Q(X - 6, Y + 12, 12, 2, '#9ca3b8');
  Q(X - 2, Y + 8, 4, 1, out ? (((t * 2) | 0) % 2 ? '#5cc8ff' : '#3a4a6a') : '#7fe0b4');                // ждёт или заряжает
}
