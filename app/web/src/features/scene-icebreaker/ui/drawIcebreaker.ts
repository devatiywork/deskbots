// Ледокол в правом окне (мелкие пиксели, в кадр g): обрезается рамой стекла, перемычка окна рисуется поверх.
import { Q, S, q, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { env } from '@/entities/environment';
import { WINDOWS } from '@/entities/world';
import { icebreaker } from '../model/ice';

export function drawIcebreaker(t: number) {
  const ice = icebreaker();
  if (!ice) return;
  setTarget(g);
  const X = WINDOWS[1] * 2, gx = X + 1, gy = 53, gw = 50, seaY = gy + 23, night = env.phase === 'night', sx = Math.round(gx + ice.x);
  g.save(); g.beginPath(); g.rect(gx / S, gy / S, gw / S, 30 / S); g.clip();
  Q(sx + 9, seaY + 3, gx + gw - sx - 9, 2, night ? '#1a2148' : '#4f7fae');            // полоса чистой воды за кормой
  Q(sx, seaY + 2, 10, 2, '#c43030'); q(sx - 1, seaY + 2, '#c43030'); Q(sx + 1, seaY + 4, 8, 1, '#1D1A33');
  Q(sx + 3, seaY - 1, 5, 3, '#f7f5ff'); q(sx + 4, seaY, night ? '#ffd98a' : '#5cc8ff'); q(sx + 6, seaY, night ? '#ffd98a' : '#5cc8ff');
  Q(sx + 6, seaY - 3, 2, 2, '#ffcf5c');
  for (let i = 0; i < 3; i++) { const p = (t * 0.5 + i / 3) % 1; q(sx + 7 + Math.round(p * 3), seaY - 4 - Math.round(p * 5), `rgba(225,225,235,${(0.7 * (1 - p)).toFixed(2)})`); }   // дым из трубы
  g.restore();
  Q(X + 24, seaY - 6, 3, 13, '#2b2548'); Q(X + 25, seaY - 6, 1, 13, '#3e3666');   // перемычка окна поверх корабля
}
