// Связь обоев с приложением: настройки, монитор со звуком, закрытый рабочий стол, «Позвать руководство»,
// мышь с рабочего стола. Обои лежат под иконками, поэтому мышь сюда напрямую не попадает: приложение
// пересылает движения и нажатия над пустым рабочим столом (в пикселях монитора), а мы превращаем их в события страницы.
import { agents } from '@/entities/agent';
import { npcs } from '@/entities/person';
import { config, modes, presence, sceneRegistry, server, view } from '@/entities/world';
import { cat } from '@/features/office-cat';
import { callVisit } from '@/features/scene-ermii';
import { DEMO } from '@/shared/lib/flags';
import { audio } from '@/shared/audio';
import { api, isApp, on } from '@/shared/api/tauri';
import { applySettings, tipClear } from '@/widgets/office-scene';

declare global {
  interface Window { __wpMouse?: (type: 'move' | 'down' | 'up' | 'leave', x: number, y: number) => void }
}

/** Подсветка элемента панели под курсором: CSS :hover от пересланной мыши не срабатывает. */
let hovered: Element | null = null;
function setHover(el: Element | null) {
  if (el === hovered) return;
  hovered?.removeAttribute('data-hover');
  el?.setAttribute('data-hover', '');
  hovered = el;
}

function bindMouse() {
  let downAt: [number, number] | null = null;
  window.__wpMouse = (type, x, y) => {
    const cx = x / view.dpr, cy = y / view.dpr;
    const el = document.elementFromPoint(cx, cy) ?? document.body;
    const fire = (name: string) => el.dispatchEvent(new MouseEvent(name, { clientX: cx, clientY: cy, bubbles: true }));
    if (type === 'move') { setHover(el.closest('[data-hit]')); fire('mousemove'); }
    else if (type === 'down') { downAt = [cx, cy]; el.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true })); fire('mousedown'); }
    else if (type === 'up') { fire('mouseup'); if (downAt && Math.hypot(cx - downAt[0], cy - downAt[1]) < 8) fire('click'); downAt = null; }
    else { setHover(null); tipClear(); }
  };
}

/** Только для проверки (#demo): состояние сцены доступно автотестам в консоли. */
export function exposeDebug() {
  if (!DEMO) return;
  (window as unknown as { __office: object }).__office = { agents, npcs, cat, sceneRegistry, presence, server, config };
}

let bound = false;
export function bindApp() {
  if (bound || !isApp()) return;
  bound = true;
  bindMouse();
  api.getSettings().then(applySettings).catch(() => {});
  on('settings', applySettings);
  // офис на нескольких мониторах: звук только у окна на главном; закрыт рабочий стол — тишина
  const askScreen = () => api.screen().then(r => { modes.second = !r.main; modes.deskHidden = r.desk === false; audio.apply(); }).catch(() => {});
  void askScreen();
  on('screen', () => void askScreen());
  on('desk', shown => { modes.deskHidden = !shown; audio.apply(); });
  on('visit', () => callVisit());
}
