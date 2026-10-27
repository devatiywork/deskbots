// Фургон пиццерии сверху: рисуется в свой маленький холст (40×22 клетки) и кладётся в кадр с поворотом.
// Стоит у входа (state 'stop') — красные стоп-сигналы и аварийка.
import { env } from '@/entities/environment';
import type { Car } from '@/entities/car';
import { shade } from '@/shared/lib/color';
import { Q, glow, layer, q, setTarget } from '@/shared/lib/pixel/canvas';
import { textQ } from '@/shared/lib/pixel/font';
import { g } from '@/shared/lib/pixel/layers';
import T from '@/shared/i18n/ru/scenes.json';
import { local } from '../lib/pizza';

const [vanC, vctx] = layer(40, 22);

/** Рисунок фургона: ставится в car.draw, drawCar вызывает его вместо обычной машины. */
export function drawVan(v: Car, t: number) {
  const O = '#4a160e', B = '#d9442e', BL = '#ef6a4f', BD = '#a8321f', ox = 11, oy = 10;
  setTarget(vctx); vctx.clearRect(0, 0, 40, 22);
  Q(ox + 2, oy + 24, 56, 3, 'rgba(0,0,0,0.3)');
  for (const wx of [ox + 8, ox + 42]) { Q(wx, oy - 2, 8, 3, '#141220'); Q(wx, oy + 23, 8, 3, '#141220'); }
  Q(ox, oy, 58, 24, O); Q(ox + 1, oy + 1, 56, 22, B); Q(ox + 1, oy + 1, 56, 2, BL); Q(ox + 1, oy + 21, 56, 2, BD);
  Q(ox + 50, oy + 2, 7, 20, shade(B, 0.9)); Q(ox + 50, oy + 2, 7, 1, BL); Q(ox + 56, oy + 4, 1, 16, '#2b2a24');
  Q(ox + 44, oy + 3, 6, 18, '#6f93b8'); Q(ox + 45, oy + 4, 2, 16, '#b8d6f2');
  Q(ox + 3, oy + 3, 40, 18, shade(B, 1.06));
  if (env.season === 'winter') Q(ox + 4, oy + 4, 38, 16, '#e8eef8');
  // кусок пиццы и надпись на крыше
  Q(ox + 4, oy + 6, 8, 2, '#c98a3a'); Q(ox + 5, oy + 8, 6, 2, '#ffcf5c'); Q(ox + 6, oy + 10, 4, 2, '#ffcf5c'); Q(ox + 7, oy + 12, 2, 2, '#ffcf5c'); q(ox + 6, oy + 8, '#e0453c'); q(ox + 8, oy + 10, '#e0453c');
  Q(ox + 14, oy + 7, 27, 10, '#f7f5ff'); textQ(T.pizza.van, ox + 18, oy + 10, 1, '#d9442e');
  Q(ox + 46, oy - 2, 2, 2, O); Q(ox + 46, oy + 24, 2, 2, O);
  Q(ox + 57, oy + 2, 1, 4, '#fff3c4'); Q(ox + 57, oy + 18, 1, 4, '#fff3c4');
  const stopped = v.state === 'stop';
  const tail = stopped ? '#ff2a2a' : '#c43c3c';
  Q(ox, oy + 2, 1, 4, tail); Q(ox, oy + 18, 1, 4, tail);
  if (stopped && ((t * 2.5) | 0) % 2) { Q(ox, oy, 2, 2, '#ffb030'); Q(ox + 56, oy, 2, 2, '#ffb030'); Q(ox, oy + 22, 2, 2, '#ffb030'); Q(ox + 56, oy + 22, 2, 2, '#ffb030'); }
  if (v.side) { Q(ox + 30, oy, 12, 2, '#141220'); Q(ox + 17, oy - 3, 13, 3, O); Q(ox + 18, oy - 2, 11, 2, B); }   // боковая дверь открыта
  setTarget(g);
  g.save(); g.translate(v.x, v.y); g.rotate(v.ang ?? 0); g.imageSmoothingEnabled = false; g.drawImage(vanC, -20, -11, 40, 22); g.restore();
  if (env.phase !== 'day') { const n = local(v, 22, 0); glow(n.x, n.y, 9, 5, '255,240,190', 0.22); }
}
