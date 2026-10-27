// Живое в комнате каждый кадр: стрелки часов, график на телевизоре, пар от кофемашины, звёзды на ковре,
// кот на холодильнике; мебель на полу по глубине (y); вечерний свет в комнате.
import { Q, S, discQ, lineQ, q, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { rng } from '@/shared/lib/random';
import { env, localNow } from '@/entities/environment';
import { CAFE, CHILL, DESKS } from '@/entities/world';
import { arrived, type Agent } from '@/entities/agent';
import { ROOM_DIM, ROOM_WARM } from './palette';
import { potQ } from './props';
import { drawChairBack, drawDesk } from './desks';
import { drawXmasTree } from './decor';
import { RACK, drawRack } from './rack';
import { drawBillboard } from './billboard';

/** что-то на полу: рисуется по возрастанию y (глубина) */
export interface DepthItem { y: number; draw: () => void }

/** Кухонный стол: пиццу и шоколадку в кофейне ведут фичи, сюда приходит их состояние. */
export interface KitchenState {
  /** до какого времени на столе пицца */
  pizzaUntil: number;
  /** когда двое сели в кофейню (шоколадка понемногу съедается) */
  cafeSince: number;
  drawPizza: (cx: number, cy: number, t: number) => void;
}

/** Живое на стенах: часы (системное время), телевизор, пар, звёзды на ковре, чёрный кот на холодильнике. */
export function drawWallLive(t: number) {
  setTarget(g);
  // часы: секундная стрелка тикает
  const k = localNow(), hh = (((k.h % 12) + k.m / 60) / 12) * 6.283 - 1.571, mm = ((k.m + k.s / 60) / 60) * 6.283 - 1.571, ss = (k.s / 60) * 6.283 - 1.571;
  lineQ(524, 64, 524 + Math.cos(mm) * 7, 64 + Math.sin(mm) * 7, '#1D1A33');
  lineQ(524, 64, 524 + Math.cos(hh) * 4.5, 64 + Math.sin(hh) * 4.5, '#4A37C9');
  lineQ(524, 64, 524 + Math.cos(ss) * 7.5, 64 + Math.sin(ss) * 7.5, '#ff5c5c'); q(524, 64, '#1D1A33');
  // телевизор: бежит график с заливкой
  const tv = rng(((t * 1.5) | 0) + 5);
  Q(203, 57, 54, 23, '#16203e'); for (let y = 61; y < 80; y += 6) Q(203, y, 54, 1, '#1d2a50');
  let py = 70;
  for (let x = 0; x < 54; x++) {
    py = Math.max(60, Math.min(77, py + (tv() < 0.5 ? -1 : 1)));
    Q(203 + x, py + 1, 1, 79 - py, 'rgba(92,200,255,0.14)'); q(203 + x, py, x > 38 ? '#7fe0b4' : '#5cc8ff');
  }
  // пар от кофемашины
  for (let i = 0; i < 4; i++) { const p = (t * 0.8 + i / 4) % 1; Q(558 + Math.round(Math.sin(t * 2 + i) * 2), 88 - p * 16, 1, 1, `rgba(255,255,255,${(0.7 * (1 - p)).toFixed(2)})`); }
  // звёзды на ковре мерцают
  for (let i = 0; i < 12; i++) {
    const a = Math.sin(t * 1.3 + i * 2.1);
    if (a > 0.3) {
      const x = 172 + ((i * 37) % 120), y = 122 + ((i * 23) % 96), c = a > 0.8 ? '#ffe7a3' : '#c9bcff';
      q(x, y, c); if (a > 0.8) { q(x - 1, y, c); q(x + 1, y, c); q(x, y - 1, c); q(x, y + 1, c); }
    }
  }
  // чёрный кот на холодильнике
  Q(600, 104, 10, 8, '#1b1830'); Q(598, 100, 7, 6, '#1b1830'); q(598, 99, '#1b1830'); q(604, 99, '#1b1830');
  Q(610, 104 + Math.round(Math.sin(t * 1.7) * 2), 2, 6, '#1b1830');
  if (t % 4.3 > 0.15) { q(600, 102, '#ffd35c'); q(603, 102, '#ffd35c'); }
}

const ownerOf = (p: { owner?: object | null }) => p.owner as Agent | null | undefined;

/**
 * Мебель на полу с глубиной: столы и спинки кресел, журнальный столик, кресла-мешки, диван, аркада,
 * кухонный стол, ёлка, серверная стойка, билборд. Сборщик кадра добавляет к ним тигра, стажёров, агентов,
 * гостей и кота и сортирует всё по y.
 */
export function furnitureItems(t: number, kitchen: KitchenState): DepthItem[] {
  const items: DepthItem[] = [];
  for (const d of DESKS) { items.push({ y: d.y0 + 13, draw: () => drawDesk(d, t) }); items.push({ y: d.y0 + 21, draw: () => drawChairBack(d) }); }
  items.push({ y: 72, draw: () => {                 // журнальный столик: книги, кружка, растение
    Q(208, 142, 44, 3, 'rgba(0,0,0,0.2)');
    Q(207, 127, 46, 16, '#3a2416'); Q(208, 128, 44, 10, '#9a6a44'); Q(208, 128, 44, 1, '#c09068'); Q(208, 138, 44, 4, '#6b4a33'); Q(210, 142, 2, 2, '#3a2416'); Q(248, 142, 2, 2, '#3a2416');
    Q(213, 130, 11, 3, '#4A37C9'); Q(213, 130, 11, 1, '#7d6ef0'); Q(212, 133, 12, 2, '#ff9ab8');
    Q(230, 131, 5, 5, '#f7f5ff'); Q(231, 131, 3, 1, '#6b4a33'); q(235, 133, '#d8d0f0'); if (((t * 2) | 0) % 2) { q(232, 128, 'rgba(255,255,255,0.6)'); q(233, 126, 'rgba(255,255,255,0.4)'); }
    potQ(244, 137, '#b5643c');
  } });
  items.push({ y: 74, draw: () => {                 // кресла-мешки
    discQ(168, 149, 12, '#5e2420', 0.8); discQ(168, 147, 11, '#c95f4c', 0.8); discQ(166, 145, 7, '#e0745f', 0.8); Q(161, 141, 3, 2, '#f39a85'); lineQ(160, 150, 176, 150, '#a94c3c');
    discQ(292, 149, 12, '#123c58', 0.8); discQ(292, 147, 11, '#3f9fd0', 0.8); discQ(290, 145, 7, '#5cc8ff', 0.8); Q(285, 141, 3, 2, '#a8e4ff'); lineQ(284, 150, 300, 150, '#2f7fae');
  } });
  items.push({ y: 92, draw: () => {                 // сиденье дивана с подушками
    Q(182, 178, 96, 28, '#22104e'); Q(184, 180, 92, 24, '#6a42bd'); Q(184, 180, 92, 2, '#8a66da');
    for (const sx of [218, 242]) Q(sx, 182, 1, 20, '#53309e');
    Q(184, 200, 92, 2, '#53309e');
    Q(186, 182, 11, 9, '#c94f3c'); Q(187, 182, 9, 7, '#ff8a6b'); Q(187, 182, 9, 1, '#ffb39c');
    Q(263, 182, 11, 9, '#c95f88'); Q(264, 182, 9, 7, '#ff9ab8'); Q(264, 182, 9, 1, '#ffc2d6');
  } });
  items.push({ y: 106, draw: () => {                // спинка и подлокотники
    Q(178, 202, 104, 14, '#22104e'); Q(180, 204, 100, 10, '#7a4fd1'); Q(180, 204, 100, 2, '#9a76ea'); Q(180, 212, 100, 2, '#5c37a8');
    for (let x = 190; x < 280; x += 14) q(x, 208, '#5c37a8');
    for (const ax of [176, 276]) { Q(ax - 2, 174, 12, 42, '#22104e'); Q(ax, 176, 8, 38, '#5c37a8'); Q(ax, 176, 8, 3, '#8460d6'); Q(ax + 6, 179, 2, 35, '#4a2c8e'); }
  } });
  items.push({ y: 134, draw: () => {                // аркадный автомат с захватчиком на экране
    Q(157, 237, 32, 36, '#0e0b1c'); Q(158, 238, 30, 34, '#2b2350'); Q(158, 238, 4, 34, '#3d3470'); Q(184, 238, 4, 34, '#1f1a3c');
    Q(160, 240, 26, 6, ((t * 1.5) | 0) % 4 ? '#ff5aa0' : '#ff8cc0'); Q(161, 241, 24, 1, '#ffc2dc'); for (let x = 163; x < 184; x += 4) q(x, 243, '#ffd6e8');
    Q(161, 247, 24, 15, '#120f24'); Q(163, 249, 20, 11, '#0d0b1c');
    const o = ownerOf(CHILL[4]), playing = !!o && arrived(o) && o.place === CHILL[4];
    const ar = (t * (playing ? 6 : 2)) | 0, INV = ['.#...#.', '..###..', '.##.##.', '#######', '#.#.#.#'];
    const ix = 165 + (ar % 8), fr = ar % 2;
    for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 7; xx++) if (INV[yy][xx] === '#' && !(fr && yy === 4 && xx % 2 === 0)) q(ix + xx, 250 + yy, '#7fe0b4');
    Q(167 + ((ar * 5) % 12), 258, 4, 1, '#ff5aa0'); if (playing && ((t * 3) | 0) % 2) q(169 + ((ar * 5) % 12), 256, '#ffcf5c');
    Q(160, 262, 26, 8, '#3d3470'); Q(160, 262, 26, 1, '#5a4c96'); Q(164, 263, 2, 3, '#141220'); Q(163, 262, 4, 2, '#ff5c5c');
    Q(171, 265, 2, 2, '#5cc8ff'); Q(175, 265, 2, 2, '#ffcf5c'); Q(179, 265, 2, 2, '#7fe0b4'); Q(158, 238, 1, 34, '#ff5aa0');
  } });
  items.push({ y: 117, draw: () => {                // кухонный стол с пончиками и табуретами
    const { pizzaUntil, cafeSince, drawPizza } = kitchen;
    discQ(588, 240, 14, 'rgba(0,0,0,0.15)', 0.6);
    for (const sx of [568, 608]) { discQ(sx, 240, 6, '#141220', 0.7); discQ(sx, 238, 6, '#353048', 0.7); Q(sx - 3, 235, 5, 1, '#4a4466'); }
    discQ(588, 232, 16, '#5b3d2a', 0.7); discQ(588, 231, 15, '#c98f5c', 0.7); discQ(586, 229, 9, '#ddaa7a', 0.7);
    const cafe = CAFE.filter(s => { const o = ownerOf(s); return !!o && !!o.brk?.cafe && arrived(o) && o.place === s; }).length;
    if (pizzaUntil > t) drawPizza(588, 229, t);
    if (!cafe && pizzaUntil <= t) {
      discQ(583, 230, 5, '#f7f5ff', 0.7); discQ(583, 229, 3, '#e0915f', 0.7); q(583, 229, '#f7f5ff'); q(581, 228, '#ff9ab8'); q(585, 228, '#5cc8ff'); q(583, 227, '#ffcf5c');
      Q(594, 228, 4, 4, '#ffcf5c'); Q(594, 228, 4, 1, '#c97a2c'); q(598, 229, '#d8b040');
    } else if (cafe) {
      // кофейня: две чашки на блюдцах и плитка шоколада, которая понемногу исчезает
      for (const cx2 of [578, 598]) { Q(cx2 - 3, 236, 8, 2, '#e6e2f4'); Q(cx2 - 1, 232, 4, 4, '#f7f5ff'); Q(cx2 - 1, 232, 4, 1, '#6b4a33'); }
      const left = Math.max(1, 4 - Math.floor((t - cafeSince) / 7));
      if (pizzaUntil <= t) { Q(585, 233, 9, 5, '#d8d8e4'); for (let i = 0; i < left; i++) { Q(585 + i * 2, 233, 2, 4, '#4a2a1a'); q(585 + i * 2, 233, '#6b3d26'); } }
      if (env.phase !== 'day') { Q(588, 225, 2, 4, '#f7f5ff'); q(588, 224, ((t * 5) | 0) % 2 ? '#ffcf5c' : '#ff9a4a'); }   // свечка вечером
    }
  } });
  if (env.season === 'winter' || env.holiday === 'ny') items.push({ y: 140, draw: () => drawXmasTree(t) });
  items.push({ y: (RACK.y + RACK.h) / S, draw: () => drawRack(t) });
  items.push({ y: 167, draw: () => drawBillboard() });
  return items;
}

/** Вечером и ночью в комнате чуть темнее и теплее (после мебели и агентов, до машин и света ламп). */
export function drawRoomLight() {
  const dim = ROOM_DIM[env.phase], warm = ROOM_WARM[env.phase];
  if (dim) { g.fillStyle = dim; g.fillRect(76, 24, 232, 136); }
  if (warm) { g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,170,90,${warm})`; g.fillRect(76, 44, 232, 114); g.globalCompositeOperation = 'source-over'; }
}
