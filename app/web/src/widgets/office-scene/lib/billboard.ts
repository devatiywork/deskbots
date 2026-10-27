// Электронный билборд во дворе слева: нагрузка ПК и лимиты нейросетей.
// Рама и опоры — пиксельные в сцене; цифры рисуются поверх в полном разрешении тем же шрифтом, что и панель.
// Рама подбирается под текст, поэтому на любом мониторе билборд одного размера на экране, как панель
// (с «Крупной» панелью крупнее и он). Левый край не заходит за обрезку сцены в режиме «Чёткие пиксели».
import { Q, S, glow, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { fmtBig, hm } from '@/shared/lib/format';
import { fill } from '@/shared/i18n';
import TXT from '@/shared/i18n/ru/scene.json';
import { env } from '@/entities/environment';
import { FONT_UI, config, fontPx, screen, server, view } from '@/entities/world';

/** Рама билборда в мелких пикселях сцены и размер шрифта цифр на экране. */
export function boardBox() {
  const fs = fontPx((config.panelBig ? 3 : 2) * view.dpr), fine = view.ws / S, crop = Math.max(0, Math.ceil(-view.ox / fine));
  const x = 8 + crop, w = Math.min(Math.round((fs * 14.5) / fine) + 12, 140 - x), h = Math.min(Math.round((9 * Math.round(fs * 1.35)) / fine) + 10, 130);
  return { x, y: 296 - h, w, h, fs };
}

export function drawBillboard() {
  const { x, y, w, h } = boardBox(), phase = env.phase, night = phase === 'night', dark = '#0b0918', metal = night ? '#1d1a33' : '#3a3552';
  setTarget(g);
  Q(x + 10, 333, w - 20, 3, 'rgba(0,0,0,0.22)');
  for (const lx of [x + Math.round(w * 0.27), x + w - Math.round(w * 0.3)]) { Q(lx, y + h, 5, 334 - y - h, dark); Q(lx + 1, y + h, 2, 334 - y - h, metal); Q(lx - 2, 331, 9, 3, dark); }   // опоры
  Q(x - 2, y - 2, w + 4, h + 4, dark); Q(x - 1, y - 1, w + 2, h + 2, metal); Q(x - 1, y - 1, w + 2, 1, night ? '#2e2a50' : '#5a5478');
  Q(x + 2, y + 2, w - 4, h - 4, '#06050d');
  for (let yy = y + 3; yy < y + h - 2; yy += 2) Q(x + 2, yy, w - 4, 1, 'rgba(90,110,200,0.06)');   // строки светодиодной матрицы
  for (let k = 0; k < 4; k++) { const lx = x + Math.round(((k + 0.5) * w) / 4) - 3; Q(lx, y - 5, 7, 3, dark); Q(lx + 1, y - 4, 5, 1, night ? '#fff3c4' : '#8a82b0'); }   // прожекторы
  if (env.season === 'winter') Q(x - 2, y - 4, w + 4, 2, '#f4f7fd');
  if (night || phase === 'dusk') {
    g.globalCompositeOperation = 'lighter';
    glow((x + w / 2) / S, (y + h) / S + 6, Math.round((34 * w) / 128), 7, '110,140,255', night ? 0.16 : 0.08);
    g.globalCompositeOperation = 'source-over';
  }
}

/** Цвет деления полоски по заполненности: зелёный, жёлтый, красный. */
export const barCol = (f: number) => (f >= 0.85 ? '#ff5c5c' : f >= 0.6 ? '#ffcf5c' : '#7fe0b4');

/** заголовок раздела: live — справа часы и мигающая точка */
interface HeadRow { head: string; right: string; live?: boolean; col?: string }
/** [подпись, доля для полоски или null, значение, цвет полоски: null — по нагрузке] */
type BarRow = [label: string, frac: number | null, val: string, fixed?: string | null];

/** Цифры билборда на экранном холсте (полное разрешение), поверх кадра. */
export function billboardText(t: number) {
  const ctx = screen.ctx;
  if (!ctx) return;
  const B = TXT.billboard, { ox, oy, ws } = view;
  const { x, y, w, h, fs } = boardBox(), now = Date.now();
  const X0 = Math.round(ox + ((x + 6) / S) * ws), Y0 = Math.round(oy + ((y + 5) / S) * ws), Wd = Math.round(((w - 12) / S) * ws), Ht = ((h - 10) / S) * ws, lh = Ht / 9;
  const p = server.pcStats, c = server.limits?.claude, x5 = server.limits?.codex?.five, xw = server.limits?.codex?.week;
  const pct = (v: number | null | undefined) => (v == null ? null : Math.max(0, Math.min(1, v / 100)));
  const cx5 = x5 && x5.reset > now ? x5.pct : x5 ? 0 : null, cxw = xw && xw.reset > now ? xw.pct : xw ? 0 : null;
  const claudeHead = !c ? '' : c.limited ? (c.limited > 0 ? fill(B.limitUntil, { time: hm(c.limited) }) : B.limitHit) : c.reset > now ? fill(B.reset, { time: hm(c.reset) }) : B.notStarted;
  const claudeBar = !c || c.limited ? (c?.limited ? 1 : null) : c.pct != null ? pct(c.pct) : c.reset > now ? 1 - (c.reset - now) / 18e6 : 0;
  const claudeVal = !c ? B.none : c.limited ? B.stop : c.pct != null ? `${c.pct}%` : c.reset > now ? fill(B.tokens, { n: fmtBig(c.tokens) }) : '0';
  const rows: (HeadRow | BarRow)[] = [
    { head: B.pc, right: '', live: true },
    [B.cpu, p ? pct(p.cpu) : null, p ? `${p.cpu}%` : B.none],
    [B.gpu, p?.gpu ? pct(p.gpu.load) : null, p?.gpu ? `${p.gpu.load}% ${Math.round(p.gpu.temp)}°` : B.none],
    [B.ram, p ? pct(p.mem) : null, p ? `${p.mem}%` : B.none],
    { head: B.claude, right: claudeHead, col: c?.limited ? '#ff5c5c' : '#ff9a6b' },
    [B.five, claudeBar, claudeVal, c?.limited ? '#ff5c5c' : c?.pct == null ? '#7d6ef0' : null],   // без потолка полоска показывает, сколько окна прошло
    { head: B.codex, right: x5 && x5.reset > now ? fill(B.reset, { time: hm(x5.reset) }) : '', col: '#d8d8e8' },
    [B.five, pct(cx5), cx5 == null ? B.none : `${cx5}%`],
    [B.week, pct(cxw), cxw == null ? B.none : `${cxw}%`],
  ];
  const bars = rows.filter((r): r is BarRow => Array.isArray(r));
  ctx.save(); ctx.beginPath(); ctx.rect(X0 - 4, Y0 - 4, Wd + 8, Ht + 8); ctx.clip();
  ctx.font = `${fs}px ${FONT_UI}`; ctx.textBaseline = 'middle';
  const labW = Math.max(...bars.map(r => ctx.measureText(r[0]).width)) + fs * 0.6;
  const valW = Math.max(...bars.map(r => ctx.measureText(r[2]).width)) + fs * 0.6;
  const bw = Wd - labW - valW, seg = 12;
  rows.forEach((r, i) => {
    const cy = Math.round(Y0 + lh * (i + 0.5)) + 1;
    if (!Array.isArray(r)) {
      ctx.textAlign = 'left'; ctx.fillStyle = r.col || '#ffcf5c'; ctx.fillText(r.head, X0, cy);
      if (r.live) {
        const on = ((t * 1.2) | 0) % 2, d = Math.max(3, Math.round(fs * 0.3));
        ctx.textAlign = 'right'; ctx.fillStyle = '#9a92c4'; ctx.fillText(hm(now), X0 + Wd, cy);
        const tw = ctx.measureText(hm(now) + ' ').width;
        if (on) { ctx.fillStyle = '#ff5c5c'; ctx.fillRect(Math.round(X0 + Wd - tw - d * 1.5), cy - Math.round(d / 2), d, d); }
      } else if (r.right) { ctx.textAlign = 'right'; ctx.fillStyle = r.col === '#ff5c5c' ? '#ff5c5c' : '#9a92c4'; ctx.fillText(r.right, X0 + Wd, cy); }
      if (i) { ctx.fillStyle = 'rgba(125,110,240,0.35)'; ctx.fillRect(X0, Math.round(Y0 + lh * i), Wd, 1); }   // разделитель над разделом
      return;
    }
    const [label, frac, val, fixed] = r;
    ctx.textAlign = 'left'; ctx.fillStyle = '#9a92c4'; ctx.fillText(label, X0, cy);
    ctx.textAlign = 'right'; ctx.fillStyle = '#E0DAFA'; ctx.fillText(val, X0 + Wd, cy);
    if (bw < fs * 2) return;
    const bh = Math.max(3, Math.round(lh * 0.4)), sw = bw / seg, lit = frac == null ? 0 : Math.round(frac * seg);
    for (let k = 0; k < seg; k++) {
      ctx.fillStyle = k < lit ? fixed || barCol((k + 1) / seg) : '#1c1a30';
      ctx.fillRect(Math.round(X0 + labW + k * sw), cy - Math.round(bh / 2) - 1, Math.max(1, Math.round(sw) - 2), bh);
    }
  });
  ctx.restore();
}
