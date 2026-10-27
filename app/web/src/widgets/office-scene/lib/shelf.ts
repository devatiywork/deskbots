// Шкаф с кубками на месте постера с фениксом: появляется с первым кубком. Кубки — из server.trophies,
// подсветка нового кубка (блёстки) приходит от фичи кубков параметром.
import { Q, q, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { mix, shade } from '@/shared/lib/color';
import TROPHIES from '@/shared/i18n/ru/trophies.json';
import { server } from '@/entities/world';

export type TrophyId = keyof typeof TROPHIES;
/** порядок кубков на полках — как ключи в trophies.json */
export const TROPHY_IDS = Object.keys(TROPHIES) as TrophyId[];
/** шкаф с кубками (мелкие пиксели) */
export const SHELF = { x: 271, y: 53, w: 30, h: 28 };
/** низ i-го кубка: по пять на полке */
export const cupAt = (i: number) => ({ x: SHELF.x + 3 + (i % 5) * 5, y: SHELF.y + 12 + ((i / 5) | 0) * 13 });

/** новый кубок блестит до until */
export interface TrophyGlow { id: string; until: number }

export function drawShelf(t: number, glow: TrophyGlow | null) {
  const trophies = server.trophies;
  if (!trophies.length) return;                       // пока нет кубков, висит постер с фениксом
  setTarget(g);
  const { x, y, w, h } = SHELF;
  Q(x, y, w, h, '#3a2416'); Q(x + 1, y + 1, w - 2, h - 2, '#5a3d28'); Q(x + 2, y + 2, w - 4, h - 4, '#2a1c14');
  for (const sy of [y + 13, y + 26]) { Q(x + 1, sy - 1, w - 2, 2, '#8a5c3a'); Q(x + 1, sy - 1, w - 2, 1, '#a8764a'); }
  TROPHY_IDS.forEach((id, i) => {
    const c = cupAt(i);
    if (!trophies.includes(id)) { Q(c.x + 1, c.y - 1, 2, 1, '#3a2a20'); return; }   // место под будущий кубок
    const col = TROPHIES[id].color, hi = mix(col, '#ffffff', 0.5), lo = shade(col, 0.7);
    Q(c.x, c.y - 9, 4, 4, col); Q(c.x, c.y - 9, 4, 1, hi); q(c.x - 1, c.y - 8, lo); q(c.x + 4, c.y - 8, lo);
    Q(c.x + 1, c.y - 5, 2, 2, lo); Q(c.x, c.y - 3, 4, 2, shade(col, 0.55));
    if (glow?.id === id && glow.until > t && ((t * 4) | 0) % 2) { q(c.x - 1, c.y - 11, '#ffffff'); q(c.x + 4, c.y - 10, '#ffffff'); }
  });
  for (let i = 0; i < 6; i++) q(x + 4 + i, y + 9 - i, 'rgba(255,255,255,0.12)');   // блик на стекле
}
