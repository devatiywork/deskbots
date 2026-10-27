// Мышь на сцене: клик по агенту — его окно выходит вперёд, клик по коту — вкусняшка; наведение на стойку и кубки — подсказки.
import { agents } from '@/entities/agent';
import { view } from '@/entities/world';
import { focusAgent } from '@/features/focus-agent';
import { catHit, feedCat } from '@/features/office-cat';
import { tipClear, tipMove } from '../lib';

/** Кто под курсором: координаты события в пикселях страницы → клетки сцены. */
function agentAt(e: MouseEvent) {
  const px = e.clientX * view.dpr, py = e.clientY * view.dpr;
  const sx = (px - view.ox) / view.ws, sy = (py - view.oy) / view.ws;
  let best = null, bd = 99;
  for (const a of agents.values()) {
    if (a.arriving || a.leaving) continue;
    const d = Math.abs(sx - a.x);
    if (d < 8 && sy > a.y - 21 && sy < a.y + 2 && d < bd) { best = a; bd = d; }
  }
  return { agent: best, cat: !best && catHit(sx, sy) };
}

export function bindSceneInput(canvas: HTMLCanvasElement) {
  canvas.addEventListener('click', e => {
    const hit = agentAt(e);
    if (hit.agent) void focusAgent(hit.agent);
    else if (hit.cat) feedCat();
  });
  canvas.addEventListener('mousemove', e => tipMove(e));
  canvas.addEventListener('mouseleave', () => tipClear());
}

export { tipClear };
