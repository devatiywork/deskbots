// Вспышки салюта (мелкие пиксели, в кадр g): видны только в стёклах окон, искры разлетаются, падают и гаснут.
import { Q, S, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { WINDOWS } from '@/entities/world';
import { fw } from '../model/fireworks';

export function drawFireworks(t: number) {
  if (!fw.length) return;
  setTarget(g); g.save(); g.beginPath();
  for (const wx of WINDOWS) g.rect((wx * 2 + 1) / S, 53 / S, 50 / S, 22 / S);
  g.clip();
  for (const b of fw) {
    const k = (t - b.at) / 1.6, r = 2 + k * 9;
    g.globalAlpha = Math.max(0, 1 - k);
    for (let i = 0; i < b.n; i++) { const ang = (i / b.n) * 6.283; Q(b.x + Math.cos(ang) * r, b.y + Math.sin(ang) * r + k * k * 4, 1, 1, b.c); }
    if (k < 0.15) Q(b.x - 1, b.y - 1, 2, 2, '#ffffff');
  }
  g.restore();
}
