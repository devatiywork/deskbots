// Подсказка при наведении мыши: на серверной стойке — нагрузка ПК, на шкафу — кубки.
// Рисуется на экранном холсте в полном разрешении, над всем остальным.
import { S } from '@/shared/lib/pixel/canvas';
import { pixelBox } from '@/shared/lib/pixel/box';
import { fill } from '@/shared/i18n';
import TXT from '@/shared/i18n/ru/scene.json';
import TROPHIES from '@/shared/i18n/ru/trophies.json';
import { FONT_UI, fontPx, screen, server, view } from '@/entities/world';
import { RACK } from './rack';
import { SHELF, TROPHY_IDS, cupAt } from './shelf';

export interface Tip { text: string; x: number; y: number }
/** текущая подсказка: текст и точка на экране (пиксели холста) */
export const tooltip = { tip: null as Tip | null };

interface PointerAt { clientX: number; clientY: number }

/** Текст подсказки под мышью или null. */
export function tipAt(e: PointerAt): string | null {
  const { dpr, ox, oy, ws } = view, T = TXT.tip;
  const px = e.clientX * dpr, py = e.clientY * dpr, qx = ((px - ox) / ws) * S, qy = ((py - oy) / ws) * S;
  if (qx >= RACK.x && qx <= RACK.x + RACK.w && qy >= RACK.y && qy <= RACK.y + RACK.h) {
    const p = server.pcStats;
    if (!p) return T.noServer;
    // память видеокарты сервер присылает сверх типа PcStats
    const gpu = p.gpu as (NonNullable<typeof p.gpu> & { vram?: number }) | undefined;
    return fill(T.pc, { cpu: p.cpu, mem: p.mem }) + (gpu ? fill(T.gpu, { load: gpu.load, temp: Math.round(gpu.temp), vram: String(gpu.vram) }) : '');
  }
  const trophies = server.trophies;
  if (trophies.length && qx >= SHELF.x && qx <= SHELF.x + SHELF.w && qy >= SHELF.y && qy <= SHELF.y + SHELF.h) {
    const i = TROPHY_IDS.findIndex((_, k) => { const c = cupAt(k); return qx >= c.x - 1.5 && qx <= c.x + 5 && qy >= c.y - 12 && qy <= c.y + 1; });
    if (i >= 0) { const id = TROPHY_IDS[i]; return fill(trophies.includes(id) ? T.cup : T.cupMissing, { title: TROPHIES[id].title }); }
    return fill(T.cups, { n: trophies.length, total: TROPHY_IDS.length });
  }
  return null;
}

/** Мышь сдвинулась (mousemove): подсказка появляется над стойкой и кубками. */
export function tipMove(e: PointerAt) {
  const s = tipAt(e);
  tooltip.tip = s ? { text: s, x: e.clientX * view.dpr, y: e.clientY * view.dpr } : null;
}
/** Мышь ушла с окна (mouseleave) или с рабочего стола. */
export function tipClear() { tooltip.tip = null; }

export function drawTip() {
  const tip = tooltip.tip, ctx = screen.ctx, cv = screen.cv;
  if (!tip || !ctx || !cv) return;
  const fs = fontPx(view.ws * 0.4), u = Math.max(2, Math.round(view.ws * 0.5));
  ctx.font = `${fs}px ${FONT_UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const w = Math.ceil(ctx.measureText(tip.text).width) + u * 6, h = fs + u * 4;
  const x = Math.round(Math.max(u, Math.min(cv.width - w - u, tip.x - w / 2))), y = Math.round(Math.max(u, tip.y - h - u * 6));
  pixelBox(ctx, x, y, w, h, u, '#1D1A33', '#7d6ef0'); ctx.fillStyle = '#E0DAFA'; ctx.fillText(tip.text, x + u * 3, y + h / 2 + 1);
}
