// Праздничное: ёлка зимой и на Новый год, гирлянда под потолком на Новый год.
import { Q, q, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { env } from '@/entities/environment';

export function drawXmasTree(t: number) {
  const cx = 292, by = 280;
  Q(cx - 3, by - 6, 7, 6, '#6b4a33'); Q(cx - 6, by - 3, 13, 5, '#b5643c'); Q(cx - 6, by - 3, 13, 1, '#d07a4a');
  for (let i = 0; i < 32; i++) {
    const w = 1 + Math.floor(i * 0.42), y = by - 6 - (32 - i);
    Q(cx - w, y, w * 2 + 1, 1, i % 8 >= 6 ? '#2f6e3d' : '#3d8a4c'); q(cx - w, y, '#2a5e35');
    if (i % 8 === 2) q(cx - w + 2, y, '#58a865');
  }
  Q(cx - 1, by - 40, 3, 3, '#ffcf5c'); q(cx, by - 41, '#fff3c4');
  const cols = ['#ff5c5c', '#5cc8ff', '#ffcf5c', '#ff9ab8'];
  [[0, -32], [-3, -28], [3, -25], [-5, -21], [5, -19], [0, -23], [-8, -14], [8, -14], [2, -16], [-2, -11], [6, -10], [-10, -9]]
    .forEach(([dx, dy], i) => Q(cx + dx, by + dy, 2, 2, cols[(i + ((t * 2) | 0)) % 4]));
}

export function drawGarland(t: number) {
  if (env.holiday !== 'ny') return;
  setTarget(g);
  for (let x = 154, i = 0; x < 614; x += 7, i++) {
    const y = 49 + (i % 2);
    q(x, y - 1, '#2f6e3d'); Q(x, y, 2, 2, ['#ff5c5c', '#ffcf5c', '#5cc8ff', '#7fe0b4'][(i + ((t * 2) | 0)) % 4]);
  }
}
