// Вывод сцены на экран: масштаб и сдвиг (в «Чётких пикселях» — целый масштаб, края чуть обрезаются),
// облачки с репликами в полном разрешении пиксельным шрифтом.
import { config, crowd, FONT_UI, fontPx, screen, view, type Speaker } from '@/entities/world';
import { pixelBox } from '@/shared/lib/pixel/box';
import { H, W } from '@/shared/lib/pixel/canvas';

export function resize() {
  const cv = screen.cv;
  if (!cv) return;
  view.dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(innerWidth * view.dpr); cv.height = Math.round(innerHeight * view.dpr);
  let ws = Math.max(cv.width / W, cv.height / H);
  if (config.scaleCrisp) ws = Math.ceil(ws - 0.001);   // целый масштаб: пиксели одинаковые, края чуть обрезаются
  view.ws = ws;
  view.ox = Math.round((cv.width - W * ws) / 2); view.oy = Math.round((cv.height - H * ws) / 2);
}

/** Облачки всех, кто говорит: агентов, кота, гостей и руководства. Длинная реплика — в две строки. */
export function bubbles(t: number, extra: Speaker[] = []) {
  const ctx = screen.ctx, cv = screen.cv;
  if (!ctx || !cv) return;
  const { ws, ox, oy } = view;
  const fs = fontPx(ws * 0.4), u = Math.max(2, Math.round(ws * 0.5)), pad = u * 2;
  ctx.font = `${fs}px ${FONT_UI}`; ctx.textBaseline = 'middle';
  for (const a of [...crowd.all(), ...extra]) {
    if (!a.say || a.say.until < t || a.arriving || a.hidden) continue;
    let ls = [a.say.text];
    if (ctx.measureText(a.say.text).width > ctx.measureText('x'.repeat(26)).width) {
      // разрыв по пробелу ближе к середине
      const s = a.say.text, mid = s.length / 2;
      let br = -1;
      for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (br < 0 || Math.abs(i - mid) < Math.abs(br - mid))) br = i;
      if (br > 0) ls = [s.slice(0, br), s.slice(br + 1)];
    }
    const lineH = Math.round(fs * 1.15);
    const w = Math.ceil(Math.max(...ls.map(l => ctx.measureText(l).width))) + pad * 2 + u * 2, h = fs + pad * 2 + (ls.length - 1) * lineH;
    const cxp = Math.round(ox + a.x * ws), bottom = oy + ((a.labelY ?? a.y - 20) - 2) * ws;
    const x = Math.max(4 * u, Math.min(cv.width - w - 4 * u, Math.round(cxp - w / 2))), y = Math.round(bottom - h - u * 2);
    const fade = Math.min(1, (a.say.until - t) / 0.4, (t - (a.say.at ?? a.say.until - 4)) / 0.2);
    ctx.globalAlpha = Math.max(0, fade);
    pixelBox(ctx, x, y, w, h, u, '#f7f5ff', '#1D1A33');
    ctx.fillStyle = '#1D1A33'; ctx.fillRect(cxp - u, y + h - u, u * 3, u); ctx.fillRect(cxp, y + h, u, u * 2);
    ctx.fillStyle = '#f7f5ff'; ctx.fillRect(cxp, y + h - u, u, u);
    ctx.fillStyle = '#1D1A33'; ls.forEach((l, i) => ctx.fillText(l, x + pad + u, y + pad + fs / 2 + 1 + i * lineH));
    ctx.globalAlpha = 1;
  }
}
