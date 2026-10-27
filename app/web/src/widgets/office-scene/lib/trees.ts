// Деревья во дворах: спрайты по сезону (зимой голые ветки со снегом), в кадре качаются от ветра.
import { S, Q, discQ, lineQ, q, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { shade } from '@/shared/lib/color';
import { rng } from '@/shared/lib/random';
import { env } from '@/entities/environment';
import { TREES } from '@/entities/world';
import { LOOK, SHADOW } from './palette';
import { wind } from './wind';

export interface TreeSprite { c: HTMLCanvasElement; x: number; y: number; w: number; seed: number }

/** готовые спрайты деревьев (пересобираются вместе с фоном) */
export const treeSprites: TreeSprite[] = [];

export function buildTrees() {
  const L = LOOK[env.season];
  const list = TREES.map(([cx, cy, s], i): TreeSprite => {
    const Rf = s * 2, pad = Rf + 14, c = document.createElement('canvas'); c.width = c.height = pad * 2;
    const t2 = c.getContext('2d')!; t2.setTransform(S, 0, 0, S, 0, 0); setTarget(t2);
    const r = rng(100 + i);
    discQ(pad + 4, pad + Rf * 0.75, Rf * 0.85, 'rgba(0,0,0,0.2)', 0.45);
    Q(pad - 3, pad + Rf * 0.3, 7, Rf * 0.7, '#3e281a'); Q(pad - 2, pad + Rf * 0.3, 2, Rf * 0.7, '#6b4a33');
    if (!L.leaf) {
      // голые ветки со снегом
      discQ(pad, pad, 3, '#4a3020');
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * 6.28 + r() * 0.5, len = Rf * (0.6 + r() * 0.4);
        const ex = pad + Math.cos(a) * len, ey = pad + Math.sin(a) * len;
        lineQ(pad, pad, ex, ey, '#4a3020'); lineQ(pad + 1, pad, ex + 1, ey, '#6b4a33');
        const mx = pad + Math.cos(a) * len * 0.55, my = pad + Math.sin(a) * len * 0.55;
        lineQ(mx, my, mx + Math.cos(a + 0.7) * len * 0.4, my + Math.sin(a + 0.7) * len * 0.4, '#5a3d2b');
        lineQ(mx, my, mx + Math.cos(a - 0.6) * len * 0.3, my + Math.sin(a - 0.6) * len * 0.3, '#5a3d2b');
        for (let qn = 0; qn < 6; qn++) { const d = r() * len; Q(pad + Math.cos(a) * d, pad + Math.sin(a) * d - 1, 2, 1, '#ffffff'); }
      }
    } else {
      // крона из нескольких «шапок»: тёмный контур, середина, светлый бок слева сверху
      const [d0, d1, d2] = L.leaf, ol = shade(d0, 0.5), blobs: [number, number, number][] = [[0, 0, Rf * 0.6]];
      for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28 + r() * 0.5, d = Rf * 0.42; blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.9, Rf * (0.42 + r() * 0.1)]); }
      blobs.sort((p, p2) => p[1] - p2[1]);
      for (const [bx, by, br] of blobs) discQ(pad + bx, pad + by, br + 1.5, ol);
      for (const [bx, by, br] of blobs) { discQ(pad + bx, pad + by, br, d0); discQ(pad + bx - br * 0.18, pad + by - br * 0.22, br * 0.74, d1); }
      for (const [bx, by, br] of blobs) discQ(pad + bx - br * 0.38, pad + by - br * 0.42, Math.max(1, br * 0.32), d2);
      for (let k = 0; k < Rf * 7; k++) { const a = r() * 6.28, d = r() * Rf * 0.95; q(pad + Math.cos(a) * d, pad + Math.sin(a) * d, r() < 0.55 ? shade(d0, 0.82) : shade(d2, 1.1)); }
      if (L.bloom) for (let k = 0; k < Rf * 3; k++) { const a = r() * 6.28, d = r() * Rf * 0.9; Q(pad + Math.cos(a) * d, pad + Math.sin(a) * d, 2, 2, L.bloom[(r() * 2) | 0]); }
      if (env.season === 'autumn') for (let k = 0; k < Rf * 1.5; k++) { const a = r() * 6.28, d = r() * Rf * 0.9; q(pad + Math.cos(a) * d, pad + Math.sin(a) * d, '#ffd35c'); }
    }
    const shadow = SHADOW[env.phase];
    if (shadow) { t2.globalCompositeOperation = 'source-atop'; t2.fillStyle = shadow; t2.fillRect(0, 0, c.width, c.height); }
    setTarget(g);
    return { c, x: (cx * 2 - pad) / S, y: (cy * 2 - pad) / S, w: c.width / S, seed: i * 1.7 };
  });
  treeSprites.length = 0;
  treeSprites.push(...list);
}

/** Деревья в кадре: крона качается от порыва ветра (из кадра frame старого движка). */
export function drawTrees(t: number) {
  for (const s of treeSprites) g.drawImage(s.c, s.x + Math.round(Math.sin(t * 1.4 + s.seed) * wind.gust * 2.4) / S, s.y, s.w, s.w);
}
