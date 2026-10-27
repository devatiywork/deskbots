// Кубки: получаются один раз и навсегда (сервер хранит их в office-state.json), стоят в шкафу вместо постера.
// Новый кубок: подсвечивается в шкафу, конфетти, фанфары, агент объявляет; шина trophy — руководство хвалит.
import { sfx } from '@/shared/audio';
import { fill } from '@/shared/i18n';
import H from '@/shared/i18n/ru/hookfx.json';
import TR from '@/shared/i18n/ru/trophies.json';
import { S } from '@/shared/lib/pixel/canvas';
import { pick } from '@/shared/lib/random';
import { bus, server } from '@/entities/world';
import { sceneCrew, sceneSay } from '@/entities/agent';
import { confetti } from './confetti';

export interface TrophyInfo { title: string; color: string }
/** подсветка нового кубка в шкафу: какой и до какого времени */
export interface TrophyGlow { id: string; until: number }

export const TROPHY: Record<string, TrophyInfo> = TR;
/** порядок мест в шкафу */
export const TROPHY_IDS = Object.keys(TROPHY);

// шкаф и место кубка в мелких пикселях: копия из widgets/office-scene (фичам виджеты недоступны)
const SHELF = { x: 271, y: 53, w: 30, h: 28 };
const cupAt = (i: number) => ({ x: SHELF.x + 3 + (i % 5) * 5, y: SHELF.y + 12 + ((i / 5) | 0) * 13 });   // низ кубка

const trophyQueue: string[] = [];
let trophyNext = 0, glow: TrophyGlow | null = null;

/** Какой кубок сейчас подсвечен: передаётся в drawShelf. */
export const trophyGlow = (): TrophyGlow | null => glow;

/** Кубок от хука встаёт в очередь (неизвестные пропускаются). */
export function queueTrophy(id: string) { if (TROPHY[id]) trophyQueue.push(id); }

/** Новые кубки показываются по одному, не чаще раза в 9 секунд. */
export function trophyTick(t: number) {
  if (!trophyQueue.length || t < trophyNext) return;
  const id = trophyQueue.shift()!, c = cupAt(TROPHY_IDS.indexOf(id));
  trophyNext = t + 9; glow = { id, until: t + 8 };
  if (!server.trophies.includes(id)) server.trophies = [...server.trophies, id];
  confetti((c.x + 2) / S, (c.y - 6) / S, 50); sfx.fanfare();
  const a = pick(sceneCrew()); if (a) sceneSay(a, fill(H.newTrophy, { title: TROPHY[id].title }), t);
  bus.emit('trophy', { id });
}
