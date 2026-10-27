// Рисование чаек сверху в мелких пикселях, в текущий холст кадра (поверх погоды, под подписями).
import { Q, S } from '@/shared/lib/pixel/canvas';
import { bigGull, gulls } from '../model/gulls';

/** Вид сверху: тело вдоль полёта, крылья поперёк, при взмахе короче; k — размер (1.7 — крупная чайка сценки). */
export function drawGull(x: number, y: number, sx: number, t: number, k: number, ph: number) {
  const X = Math.round(x * S), Y = Math.round(y * S), f = Math.sin(t * 9 + ph), span = Math.max(3, Math.round(11 * k * (0.7 + 0.3 * f)));
  const c = (dx: number, dy: number, w: number, h: number, col: string) => Q(sx > 0 ? X + dx : X - dx - w + 1, Y + dy, w, h, col);
  Q(X - span, Y + Math.round(24 * k), span * 2, 2, 'rgba(0,0,0,0.10)');                // тень на земле
  for (let i = 1; i <= span; i++) {
    const back = Math.round(i * 0.4), col = i > span - 2 ? '#3d3f4c' : '#c9ccd8';
    c(-back, -1 - i, 2, 1, col); c(-back, i, 2, 1, col);
  }
  const B = Math.max(3, Math.round(7 * k));
  c(-Math.floor(B / 2) - 2, -1, 2, 2, '#e6e6ee'); c(-Math.floor(B / 2), -1, B, 2, '#f7f7fb'); c(Math.ceil(B / 2), -1, 2, 2, '#ffffff'); c(Math.ceil(B / 2) + 2, -1, 1, 1, '#ffcf3a');
}

/** Стайки и чайка сценки. */
export function drawGulls(t: number) {
  for (const b of gulls) drawGull(b.x, b.y, b.dir, t, 0.9, b.ph);
  const m = bigGull();
  if (m) drawGull(m.x, m.y, m.sx, t, 1.7, 0);
}
