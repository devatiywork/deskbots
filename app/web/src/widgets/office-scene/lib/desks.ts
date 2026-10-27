// Рабочие столы и свет: стол с монитором (код, график, «ждёт тебя»), кресло, настольные лампы,
// уютный свет в комнате, фонари и гирлянда на улице, светлячки тёплыми ночами.
import { Q, S, W, discQ, glow, lineQ, q, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { textQ } from '@/shared/lib/pixel/font';
import { shade } from '@/shared/lib/color';
import { rng } from '@/shared/lib/random';
import { sfx } from '@/shared/audio';
import { env, isWet } from '@/entities/environment';
import { DESKS, FAIRY, LAMPS, SPOTS, type Desk } from '@/entities/world';
import { KIND, arrived, type Agent } from '@/entities/agent';
import { featureState } from './featureState';
import { flicker } from './wind';
import { potQ } from './props';

const ownerOf = (d: Desk) => d.owner as Agent | null | undefined;
/** хозяин стола сидит за ним */
const atDesk = (d: Desk, o: Agent | null | undefined) => !!o && arrived(o) && o.place === d;

/** Лампа включается через полсекунды после того, как сел, гаснет через 1.2 с после ухода; щёлкает. */
export function lampStep(_dt: number, t: number) {
  for (const d of DESKS) {
    const want = atDesk(d, ownerOf(d)) ? 1 : 0;
    if (want && !d.lamp) { if (!d.lampOn) d.lampOn = t + 0.5; if (t >= d.lampOn) { d.lamp = 1; d.lampAt = t; d.lampOn = 0; sfx.click(); } }
    else if (!want && d.lamp) { if (!d.lampOn) d.lampOn = t + 1.2; if (t >= d.lampOn) { d.lamp = 0; d.lampOn = 0; sfx.click(); } }
    else d.lampOn = 0;
  }
}
/** При включении лампа пару раз моргает; при отключении света не горит. */
export const lampLit = (d: Desk, t: number) => !!d.lamp && !featureState.outage && !(t - (d.lampAt ?? 0) < 0.45 && ((t * 16) | 0) % 3 === 0);

export const CODE_COLS = ['#8ff7ff', '#f7f5ff', '#ffcf5c', '#ff9ab8', '#b9a8ff', '#7fe0b4'];

export function drawDesk(d: Desk, t: number) {
  const X = d.x0 * S, Y = d.y0 * S, CX = d.cx * S, o = ownerOf(d), here = !!o && arrived(o) && o.place === d;
  // стол: столешница с волокнами, передняя грань, тумба с ящиками
  Q(X + 2, Y + 26, 48, 4, 'rgba(0,0,0,0.18)');
  Q(X - 1, Y - 1, 50, 28, '#4a2e1a'); Q(X, Y, 48, 20, '#d39a66'); Q(X, Y, 48, 1, '#eab98a');
  for (let k = 0; k < 4; k++) Q(X + 3 + k * 11, Y + 4 + (k % 3) * 5, 6, 1, '#c48a57');
  Q(X, Y + 20, 48, 6, '#a8703f'); Q(X, Y + 20, 48, 1, '#8a5a32');
  Q(X + 33, Y + 19, 14, 12, '#2e2a40'); Q(X + 34, Y + 20, 12, 10, '#a49cc4'); Q(X + 34, Y + 24, 12, 1, '#7f77a3'); Q(X + 38, Y + 22, 4, 1, '#e8e4f8'); Q(X + 38, Y + 27, 4, 1, '#e8e4f8');
  // монитор на ножке
  Q(CX - 6, Y + 6, 13, 2, '#2d2a40'); Q(CX - 1, Y + 3, 3, 3, '#3a3650');
  Q(X + 8, Y - 16, 32, 20, '#08070f'); Q(X + 9, Y - 15, 30, 18, '#1f1c30'); Q(X + 9, Y - 15, 30, 1, '#3a3656');
  const sx = X + 11, sy = Y - 13, sw = 26, sh = 13;
  if (featureState.powerOff) Q(sx, sy, sw, sh, '#07060c');           // свет отключили: мониторы погасли
  else if (here && o.status === 'working') {
    // бегущий код с подсветкой, сверху вкладка с именем папки проекта
    Q(sx, sy, sw, sh, '#0e1630');
    const scroll = (t * 1.5) | 0, tab = o.folder ? 3 : 0;
    if (tab) { Q(sx, sy, sw, 7, '#1c2a5a'); textQ(o.folder.replace(/[^A-Za-z0-9.\- ]/g, '').slice(0, 6) || '-', sx + 1, sy + 1, 1, KIND[o.kind].head); }
    for (let i = tab; i < 6; i++) {
      const rr = rng((scroll + i) * 7919 + d.cx);
      let x = sx + 1 + ((rr() * 3) | 0) * 2;
      const parts = 1 + ((rr() * 3) | 0);
      for (let p = 0; p < parts && x < sx + sw - 2; p++) {
        const len = Math.min(2 + ((rr() * 6) | 0), sx + sw - 1 - x);
        Q(x, sy + 1 + i * 2, len, 1, p === 0 ? KIND[o.kind].head : CODE_COLS[(rr() * CODE_COLS.length) | 0]); x += len + 1;
      }
    }
    if (((t * 2) | 0) % 2) Q(sx + 2, sy + sh - 1, 3, 1, '#f7f5ff');
  } else if (here && o.status === 'waiting') {
    Q(sx, sy, sw, sh, ((t * 2) | 0) % 2 ? '#ffcf5c' : '#5c4a1f'); Q(sx + 12, sy + 2, 2, 6, '#1D1A33'); Q(sx + 12, sy + 10, 2, 2, '#1D1A33');
  } else if (here || o?.brk) {
    // на месте или ушёл за кофе: на экране график
    Q(sx, sy, sw, sh, '#0e1630');
    for (let i = 0; i < sw; i += 3) { const h = 2 + ((i * 7 + d.cx) % 5); Q(sx + i, sy + sh - h, 2, h, '#1f3266'); }
    for (let i = 0; i < sw; i++) {
      const v = Math.round(sh / 2 + Math.sin(i * 0.45 + d.cx) * 3 + Math.sin(i * 0.17 + d.cx * 2) * 1.5 - i * 0.12);
      q(sx + i, sy + Math.max(1, Math.min(sh - 2, v)), i > sw * 0.7 ? '#7fe0b4' : '#5cc8ff');
    }
  } else {
    Q(sx, sy, sw, sh, '#15131f'); for (let i = 0; i < 6; i++) { q(sx + 14 + i, sy + 9 - i, '#25223a'); q(sx + 16 + i, sy + 9 - i, '#25223a'); }
  }
  Q(X + 35, Y - 15, 4, 4, '#ffcf5c'); q(X + 22, Y + 2, here ? '#7fe0b4' : '#5cc8ff');   // стикер и огонёк питания
  // клавиатура, мышь, кружка, растение или бумаги
  Q(CX - 12, Y + 9, 22, 7, '#4a4560'); Q(CX - 11, Y + 10, 20, 5, '#e9e5f6');
  for (let rr = 0; rr < 2; rr++) for (let c = 0; c < 9; c++) q(CX - 10 + c * 2, Y + 11 + rr * 2, '#aaa3c8');
  Q(CX - 5, Y + 14, 10, 1, '#c9c3e0');
  Q(CX + 13, Y + 10, 5, 7, '#4a4560'); Q(CX + 14, Y + 11, 3, 5, '#f1eefb'); q(CX + 15, Y + 11, '#aaa3c8');
  const mug = ['#f7f5ff', '#ffcf5c', '#ff9ab8', '#7fe0b4'][((d.x0 / 28) | 0) % 4];
  Q(X + 2, Y + 10, 7, 7, shade(mug, 0.55)); Q(X + 3, Y + 11, 5, 5, mug); Q(X + 3, Y + 11, 5, 1, '#6b4a33'); q(X + 9, Y + 13, shade(mug, 0.7));
  if ((d.x0 + d.y0) % 3 === 0) { Q(X + 40, Y + 3, 7, 9, '#c9c1e6'); Q(X + 41, Y + 3, 6, 8, '#f7f5ff'); Q(X + 42, Y + 5, 4, 1, '#b9b2d6'); Q(X + 42, Y + 7, 3, 1, '#b9b2d6'); Q(X + 42, Y + 9, 4, 1, '#b9b2d6'); }
  else potQ(X + 43, Y + 13, '#f3eefb', ((d.x0 / 28) | 0) % 2 ? '#ff9ab8' : null);
  // настольная лампа
  const lit = lampLit(d, t);
  Q(X + 2, Y + 6, 6, 2, '#2d2a40'); lineQ(X + 5, Y + 5, X + 4, Y, '#2d2a40');
  const alarm = here && o.status === 'waiting' && !featureState.powerOff ? (((t * 3) | 0) % 2 ? '#ff6a4a' : '#ffcf5c') : null;   // ждёт тебя: лампа мигает
  Q(X + 1, Y - 4, 7, 4, alarm || (lit ? '#ffe7a3' : '#4a4560')); Q(X + 1, Y - 4, 7, 1, alarm || (lit ? '#fff6d8' : '#5e5878')); Q(X + 2, Y, 5, 1, lit ? '#fff6d8' : '#3a3650');
  // сиденье кресла
  discQ(CX, Y + 36, 8, '#141220', 0.7); discQ(CX, Y + 35, 7, '#2b2740', 0.6); Q(CX - 4, Y + 32, 8, 1, '#3e3958');
}

/** Спинка кресла: рисуется ниже по глубине, поверх сидящего агента. */
export function drawChairBack(d: Desk) {
  const CX = d.cx * S, Y = d.y0 * S;
  Q(CX - 10, Y + 40, 21, 9, '#0f0d18'); Q(CX - 9, Y + 41, 19, 7, '#2e2a40'); Q(CX - 9, Y + 41, 19, 1, '#4a4466'); Q(CX - 9, Y + 47, 19, 1, '#221f30');
  for (let i = -6; i <= 6; i += 6) q(CX + i, Y + 44, '#3e3958');
  Q(CX - 1, Y + 49, 3, 3, '#0f0d18'); Q(CX - 7, Y + 51, 15, 1, '#0f0d18');
  Q(CX - 8, Y + 52, 2, 2, '#0f0d18'); Q(CX + 7, Y + 52, 2, 2, '#0f0d18'); Q(CX - 1, Y + 53, 3, 2, '#0f0d18');
}

/** Свет ламп и мониторов, оранжевое свечение у ждущего; уютный свет торшера, полки, бра, аркады, телевизора, ламп под вывеской. */
export function drawLampLight(t: number) {
  if (featureState.powerOff) return;
  setTarget(g);
  g.globalCompositeOperation = 'lighter';
  const phase = env.phase, k = phase === 'night' ? 0.42 : phase === 'dusk' ? 0.26 : 0.12;
  for (const d of DESKS) if (lampLit(d, t)) { glow(d.x0 + 6, d.y0 + 3, 15, 9, '255,205,130', k); glow(d.x0 + 2.5, d.y0 - 1, 4, 3, '255,240,200', k); }
  for (const d of DESKS) { const o = ownerOf(d); if (o && o.status === 'waiting' && arrived(o) && o.place === d) glow(d.x0 + 4, d.y0 - 1, 16, 11, '255,130,60', 0.3 + 0.2 * Math.sin(t * 6)); }
  const amb = phase === 'night' ? 0.4 : phase === 'dusk' ? 0.28 : 0.14;
  glow(82, 91, 18, 12, '255,210,140', amb); glow(112, 120, 10, 7, '255,210,140', amb * 0.8); glow(78, 59, 8, 10, '255,220,160', amb * 0.7);
  glow(86, 121, 11, 7, '255,90,160', amb * 0.7); glow(115, 34, 22, 10, '90,150,255', amb * 0.45);
  for (const x of SPOTS) glow(x / S, 28, 7, 10, '255,230,170', amb * 0.6);
  for (const d of DESKS) if (atDesk(d, ownerOf(d))) glow(d.cx, d.y0 - 4, 12, 7, '120,180,255', amb * 0.45);
  g.globalCompositeOperation = 'source-over';
}

const fix3 = (v: number) => +v.toFixed(3);

/** Фонари во дворах (один мерцает сильнее), отражения на мокрой дороге, гирлянда на изгороди. Днём не горят. */
export function drawStreetLights(t: number) {
  if (env.phase === 'day') return;
  const f = flicker(t), wet = isWet();
  g.globalCompositeOperation = 'lighter';
  setTarget(g);
  LAMPS.forEach((lx, i) => {
    const fi = i === 2 ? f * f : f;
    glow(lx, 166, 20, 11, '255,220,150', fix3(0.24 * fi));
    glow(lx, 155, 6, 6, '255,230,170', fix3(0.35 * fi));
    Q(lx * S - 3, 306, 7, 9, `rgba(255,226,150,${(0.85 * fi).toFixed(2)})`);
    if (wet) glow(lx, 194, 4, 12, '255,220,150', fix3(0.14 * fi));   // отражение на мокрой дороге
  });
  glow(192, 166, 10, 4, '255,220,150', 0.18);
  // гирлянда на изгороди мерцает
  for (let i = 0; i < FAIRY.length; i++) {
    const [x, y] = FAIRY[i], a = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7);
    Q(x, y, 1, 1, `rgba(255,214,140,${a.toFixed(2)})`);
    if (a > 0.93) glow(x / S, y / S, 2, 2, '255,200,120', 0.18);
  }
  if (wet) for (const [lx, c] of [[147, '255,90,160'], [237, '92,200,255']] as const) glow(lx, 200, 3, 12, c, 0.12);   // неон вывески в лужах
  g.globalCompositeOperation = 'source-over';
}

/** светлячки над травой тёплыми ночами (только во дворах, не над зданием) */
export const FLIES = Array.from({ length: 26 }, (_, i) => {
  const r = rng(500 + i);
  let x: number, y: number;
  do { x = r() * W; y = r() * 160; } while (x > 64 && x < 320 && y > 12);
  return { x, y, ph: r() * 6.28, sp: 0.5 + r() };
});

export function drawFireflies(t: number) {
  if (env.phase === 'day' || env.season === 'winter' || isWet() || env.weather === 'snow') return;
  setTarget(g);
  g.globalCompositeOperation = 'lighter';
  for (const f of FLIES) {
    const a = Math.max(0, Math.sin(t * f.sp * 1.6 + f.ph)); if (a < 0.1) continue;
    const x = f.x + Math.sin(t * 0.4 * f.sp + f.ph) * 6, y = f.y + Math.cos(t * 0.5 * f.sp + f.ph) * 3;
    glow(x, y, 3, 3, '210,255,140', 0.3 * a);
    g.fillStyle = `rgba(230,255,170,${(0.9 * a).toFixed(2)})`; g.fillRect(Math.round(x * S) / S, Math.round(y * S) / S, 1 / S, 1 / S);
  }
  g.globalCompositeOperation = 'source-over';
}
