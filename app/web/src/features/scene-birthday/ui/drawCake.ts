// Торт на кухонном столе: два яруса, четыре свечи с огоньками; после праздника исчезает по кусочку справа налево
// (мелкие пиксели, в текущий холст кадра). В кадре — сразу после стола: cakeDepthY().
import { Q, S, discQ, glow, q, target } from '@/shared/lib/pixel/canvas';
import { CAKE_TIME, CAKE_X, CAKE_Y } from '../lib/cake';
import { cakeOn, cakeState } from '../model/birthday';

const CANDLES = ['#5cc8ff', '#ff9ab8', '#7fe0b4', '#ffcf5c'];

export function drawCake(t: number) {
  if (!cakeOn(t)) return;
  const { at, until, blown } = cakeState(), X = CAKE_X, Y = CAKE_Y;
  // сколько кусков осталось из четырёх: пока горят свечи — целый
  const left = blown ? Math.max(1, Math.ceil((until - t) / (CAKE_TIME / 4))) : 4;
  discQ(X, Y + 3, 11, '#b9b2d6', 0.45); discQ(X, Y + 2, 10, '#f7f5ff', 0.45);                      // блюдо
  const cut = X - 10 + Math.round((20 * left) / 4), g = target();                                    // правее cut уже съели
  g.save(); g.beginPath(); g.rect(0, 0, cut / S, 999); g.clip();
  // нижний ярус: розовый, с кремовыми подтёками и вишенками
  Q(X - 10, Y - 7, 20, 10, '#7a3f52'); Q(X - 9, Y - 6, 18, 8, '#f3a7c0'); Q(X - 9, Y - 6, 18, 2, '#ffd6e4');
  for (let x = X - 9; x < X + 9; x += 2) q(x, Y - 4 + ((x >> 1) % 2), '#ffd6e4');
  for (const dx of [-6, -1, 4]) q(X + dx, Y - 1, '#e0453c');
  // верхний ярус: ванильный, с розовой полоской
  Q(X - 7, Y - 13, 14, 7, '#7a3f52'); Q(X - 6, Y - 12, 12, 5, '#fff3c4'); Q(X - 6, Y - 12, 12, 1, '#ffffff'); Q(X - 6, Y - 9, 12, 1, '#ff9ab8');
  // свечи: огоньки дрожат; задули — тонкий дымок пару секунд
  CANDLES.forEach((c, i) => {
    const cx = X - 5 + i * 3;
    Q(cx, Y - 16, 1, 4, c);
    if (!blown) { const f = ((t * 9 + i * 1.7) | 0) % 3; q(cx, Y - 17, f === 2 ? '#ffe7a3' : '#ff9a4a'); q(cx, Y - 18 - (f === 0 ? 1 : 0), '#ffcf5c'); }
    else if (t - blown < 2.5) { const k = (t - blown) / 2.5; q(cx + Math.round(Math.sin(t * 5 + i)), Y - 18 - Math.round(k * 6), `rgba(220,220,232,${(0.8 * (1 - k)).toFixed(2)})`); }
  });
  g.restore();
  // срез: видны слои бисквита и крема
  if (left < 4) {
    Q(cut - 1, Y - 6, 1, 8, '#f0d29a'); q(cut - 1, Y - 3, '#fff6fb'); q(cut - 1, Y, '#fff6fb');
    if (cut - 1 <= X + 6) { Q(cut - 1, Y - 12, 1, 5, '#f0d29a'); q(cut - 1, Y - 9, '#ff9ab8'); }
  }
  if (!blown) glow(X / S, (Y - 18) / S, 6, 4, '255,200,120', 0.2 + Math.sin(t * 9) * 0.04);       // свечи чуть светят
  // только что появился: пара искорок
  if (t - at < 1.2) for (let i = 0; i < 4; i++) q(X - 12 + ((i * 7 + ((t * 20) | 0)) % 24), Y - 20 + ((i * 5) % 12), '#ffffff');
}
