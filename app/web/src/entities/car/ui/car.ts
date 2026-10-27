// Рисование машины сверху в мелких пикселях: такси в шашечку, белая Тесла, чёрный лимузин GRAND ERMII, машины потока.
// Ночью фары светят мягким конусом. Рисует в кадр (g), после мебели и людей.
import { env, isWet } from '@/entities/environment';
import { shade } from '@/shared/lib/color';
import { Q, S, glow, q } from '@/shared/lib/pixel/canvas';
import { textQ } from '@/shared/lib/pixel/font';
import { g } from '@/shared/lib/pixel/layers';
import type { Car } from '../model/car';

/** надпись на лимузине — название бренда, не переводится */
const LIMO_BRAND = 'GRAND ERMII';

export function drawCar(c: Car, t: number) {
  if (c.draw) return c.draw(c, t);
  const L = c.len, X = Math.round(c.x * S) - L / 2, Y = c.y * S - 10, f = c.dir > 0, col = c.col, night = env.phase !== 'day', kind = c.ride;
  Q(X + 2, Y + 20, L - 2, 2, 'rgba(0,0,0,0.3)');
  if (isWet()) Q(X + 2, Y + 22, L - 4, 4, 'rgba(255,255,255,0.06)');
  const wheels = kind === 'limo' ? [X + 7, X + L - 14] : [X + 6, X + L - 13];
  for (const wx of wheels) { Q(wx, Y - 1, 7, 2, '#141220'); Q(wx, Y + 19, 7, 2, '#141220'); }
  // кузов
  const edge = kind === 'limo' ? '#0a090e' : shade(col, 0.5);
  Q(X, Y, L, 20, edge); Q(X + 1, Y + 1, L - 2, 18, col); Q(X + 1, Y + 1, L - 2, 2, shade(col, kind === 'limo' ? 1.9 : 1.15)); Q(X + 1, Y + 17, L - 2, 2, shade(col, 0.78));
  const at = (dx: number, w: number) => (f ? X + dx : X + L - dx - w);     // отсчёт от задка машины
  if (kind === 'tesla') {
    // белая Тесла: одно сплошное тонированное стекло от лобового до заднего, короткий капот, красная буква T
    Q(at(9, 26), Y + 3, 26, 14, '#1f2a3d'); Q(at(10, 24), Y + 4, 24, 1, '#3c5274'); Q(at(31, 3), Y + 4, 3, 12, '#4d6a94'); Q(at(12, 6), Y + 5, 6, 1, '#5a7bab');
    Q(at(9, 1), Y + 3, 1, 14, '#c9ccd6');
    Q(at(L - 6, 1), Y + 8, 1, 4, '#c43c3c'); Q(at(L - 7, 3), Y + 8, 3, 1, '#c43c3c');
    Q(at(L - 2, 2), Y + 2, 2, 3, '#e8f4ff'); Q(at(L - 2, 2), Y + 15, 2, 3, '#e8f4ff');
    Q(at(0, 2), Y + 3, 2, 14, '#b02a35');
    if (env.season === 'winter') Q(at(14, 14), Y + 4, 14, 12, '#f4f7fd');
  } else if (kind === 'limo') {
    // чёрный удлинённый лимузин: хромовые полосы, длинная тонированная крыша, золотая надпись GRAND ERMII и корона
    Q(X + 1, Y + 3, L - 2, 1, '#8d93a6'); Q(X + 1, Y + 16, L - 2, 1, '#8d93a6');
    Q(at(L - 18, 6), Y + 4, 6, 12, '#2b3a55'); Q(at(L - 17, 2), Y + 5, 2, 10, '#5b7099');
    Q(at(7, 5), Y + 5, 5, 10, '#22304a');
    Q(at(13, 53), Y + 4, 53, 12, '#0e0d13'); Q(at(13, 53), Y + 4, 53, 1, '#2a2833');
    textQ(LIMO_BRAND, at(14, 43), Y + 7, 1, '#e6c25a');
    const cx = at(59, 7);
    Q(cx, Y + 9, 7, 3, '#e6c25a'); q(cx, Y + 7, '#e6c25a'); q(cx, Y + 8, '#e6c25a'); q(cx + 3, Y + 7, '#e6c25a'); q(cx + 3, Y + 8, '#e6c25a'); q(cx + 6, Y + 7, '#e6c25a'); q(cx + 6, Y + 8, '#e6c25a'); q(cx + 3, Y + 10, '#c43c3c');
    Q(at(L - 1, 1), Y + 4, 1, 12, '#c9ccd6');
    if (env.season === 'winter') Q(at(18, 36), Y + 4, 36, 2, '#f4f7fd');
  } else {
    const wind = at(L - 17, 7), rear = at(9, 6), roof = at(15, 11);
    Q(wind, Y + 3, 7, 14, '#9cc8ff'); Q(wind + (f ? 1 : 4), Y + 4, 2, 12, '#cfe6ff');
    Q(rear, Y + 4, 6, 12, '#6f8fb8');
    Q(roof, Y + 3, 11, 14, shade(col, 0.9)); Q(roof, Y + 3, 11, 1, shade(col, 1.1));
    q(at(L - 16, 1), Y - 1, shade(col, 0.55)); q(at(L - 16, 1), Y + 20, shade(col, 0.55));
    if (env.season === 'winter') Q(roof + 1, Y + 4, 9, 12, '#f4f7fd');
    if (kind === 'taxi') {
      for (let i = 0; i < 9; i++) { Q(X + 4 + i * 4, Y + 2, 2, 2, '#1D1A33'); Q(X + 6 + i * 4, Y + 16, 2, 2, '#1D1A33'); }
      Q(roof + 2, Y + 6, 7, 8, '#1D1A33'); Q(roof + 3, Y + 7, 5, 6, night ? '#ffe27a' : '#fff6d0'); Q(roof + 3, Y + 9, 5, 1, '#1D1A33');
    }
  }
  // открытая дверь у входа
  if (kind && c.door) { const dx = Math.round(c.x * S) - 4; Q(dx - 1, Y - 7, 9, 7, edge); Q(dx, Y - 6, 7, 6, col); Q(dx, Y - 6, 7, 1, shade(col, kind === 'limo' ? 1.9 : 1.15)); Q(dx + 1, Y - 4, 5, 2, kind === 'taxi' ? '#9cc8ff' : '#2b3a55'); }
  // аварийка, пока стоит
  if (kind && c.state === 'stop' && (t * 2.5 | 0) % 2) { Q(X, Y, 2, 2, '#ffb030'); Q(X + L - 2, Y, 2, 2, '#ffb030'); Q(X, Y + 18, 2, 2, '#ffb030'); Q(X + L - 2, Y + 18, 2, 2, '#ffb030'); }
  const hx = f ? X + L - 2 : X, tx = f ? X : X + L - 2, brake = !!kind && c.state === 'come' && c.v < 40;
  if (kind !== 'tesla') { Q(hx, Y + 2, 2, 4, '#fff3c4'); Q(hx, Y + 14, 2, 4, '#fff3c4'); Q(tx, Y + 2, 2, 3, brake ? '#ff2a2a' : '#c43c3c'); Q(tx, Y + 15, 2, 3, brake ? '#ff2a2a' : '#c43c3c'); }
  else if (brake) Q(tx, Y + 3, 2, 14, '#ff2a2a');
  if (night) {
    // фары: мягкий конус света, гаснет к концу
    const hx0 = (f ? X + L : X) / S, dx = f ? 1 : -1, gr = g.createLinearGradient(hx0, 0, hx0 + dx * 30, 0);
    gr.addColorStop(0, 'rgba(255,240,190,0.3)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr;
    g.beginPath(); g.moveTo(hx0, c.y - 4); g.lineTo(hx0 + dx * 30, c.y - 9); g.lineTo(hx0 + dx * 30, c.y + 9); g.lineTo(hx0, c.y + 4); g.closePath(); g.fill(); g.restore();
    if (brake) glow(tx / S, c.y, 6, 5, '255,60,60', 0.3);
  }
}
