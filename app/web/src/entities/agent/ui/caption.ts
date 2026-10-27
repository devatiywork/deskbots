// Подпись над головой: файл или команда, у долгой команды — сколько идёт.
// Рисуется на экранном холсте в полном разрешении (как облачки), поверх таблички — по a.labelY.
import { FONT_UI, fontPx, screen, view } from '@/entities/world';
import { activity, agents, arrived } from '../model/agent';

export function captions(t: number) {
  const ctx = screen.ctx;
  if (!ctx) return;
  const { ws, ox, oy } = view;
  const fs = fontPx(ws * 0.4), u = Math.max(2, Math.round(ws * 0.5));
  ctx.font = `${fs}px ${FONT_UI}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  for (const a of agents.values()) {
    if (a.arriving || a.leaving || !arrived(a) || !a.detail || !a.hooks || a.tool === 'думает' || (a.say && a.say.until > t) || activity(a, t) !== 'work') continue;
    let s = a.detail.length > 11 ? a.detail.slice(0, 10) + '…' : a.detail;
    const run = a.sinceAt ? t - a.sinceAt : 0;
    if (/^(Bash|PowerShell)$/.test(a.tool) && run >= 10) s += ` ${Math.floor(run / 60)}:${String(Math.floor(run % 60)).padStart(2, '0')}`;
    const w = Math.ceil(ctx.measureText(s).width) + u * 4, h = fs + u * 2;
    const cx = Math.round(ox + a.x * ws), y = Math.round(oy + ((a.labelY ?? a.y - 20) - 1) * ws - h);
    ctx.globalAlpha = 0.85; ctx.fillStyle = '#1D1A33'; ctx.fillRect(Math.round(cx - w / 2), y, w, h); ctx.globalAlpha = 1;
    ctx.fillStyle = '#c9c3e6'; ctx.fillText(s, Math.round(cx - w / 2) + u * 2, y + h / 2 + 1);
  }
}
