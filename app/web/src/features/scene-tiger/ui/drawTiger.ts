// Тигр сбоку в мелких пикселях, в текущий холст кадра; в кадре — по глубине (tigerDepthY).
import { Q, S, q } from '@/shared/lib/pixel/canvas';
import { tigerNow } from '../model/tiger';

export function drawTiger(t: number) {
  const m = tigerNow();
  if (!m) return;
  const X = Math.round(m.x * S), Y = Math.round(m.y * S), walk = m.step !== 2, f = walk ? ((t * 6) | 0) % 2 : 0;
  const o = '#e8892e', d = '#1D1A33', l = '#f6e3c4';
  Q(X - 16, Y - 1, 32, 3, 'rgba(0,0,0,0.22)');
  for (const [lx, ph] of [[-12, 0], [-7, 1], [6, 0], [11, 1]]) Q(X + lx, Y - 4 + ((f + ph) % 2), 3, 4, o);   // лапы
  Q(X - 14, Y - 13, 28, 10, o); Q(X - 14, Y - 13, 28, 1, '#f4a95a'); Q(X - 13, Y - 5, 26, 2, l);           // туловище
  for (let i = 0; i < 6; i++) Q(X - 11 + i * 4, Y - 13, 1, 4 + (i % 2) * 2, d);                             // полоски
  const tw = Math.round(Math.sin(t * 3) * 2);
  Q(X - 20, Y - 15 + tw, 6, 2, o); q(X - 21, Y - 16 + tw, d); q(X - 17, Y - 15 + tw, d);                    // хвост
  Q(X + 12, Y - 20, 11, 10, o); Q(X + 13, Y - 22, 3, 2, o); Q(X + 19, Y - 22, 3, 2, o); q(X + 14, Y - 21, d); q(X + 20, Y - 21, d);
  Q(X + 17, Y - 14, 7, 4, l); q(X + 23, Y - 15, '#c45a6a'); q(X + 16, Y - 17, d); q(X + 20, Y - 17, d); Q(X + 14, Y - 19, 1, 2, d); Q(X + 21, Y - 19, 1, 2, d);
  if (!walk && ((t * 2) | 0) % 2) Q(X + 19, Y - 11, 4, 1, '#c45a6a');                 // рычит
}
