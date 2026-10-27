// Робот-пылесос: раз в час-полтора выезжает с базы у нижней стены, объезжает проходы, кухню и чилл-зону,
// тихо гудит, натыкается на агентов, катает Мурчика, если тот уснул на нём; потом возвращается на базу (сценка vacuum, другим не мешает).
import { audio, burst, filt, tone } from '@/shared/audio';
import { FAST, flag } from '@/shared/lib/flags';
import { pick, rand } from '@/shared/lib/random';
import { fill } from '@/shared/i18n';
import T from '@/shared/i18n/ru/scenes2.json';
import { V, VACUUM_DOCK, presence, sceneOn, sceneRegistry, speech, type Pt } from '@/entities/world';
import { agents, arrived, avail, sceneCrew, sceneSay, type Agent } from '@/entities/agent';

/** где пылесос стоит на базе (клетки сцены); сама база — у стены чуть ниже */
export const DOCK: Pt = VACUUM_DOCK;
/** скорость, клеток в секунду: круг по офису — около полутора минут */
const SPEED = 9;
/** больше стольких агентов за выезд не задевает */
const MAX_BUMPS = 3;

// маршрут: нижний проход → коридор → проход под вторым рядом → кухня → проход под первым рядом → чилл-зона → домой
const ROUTE: Pt[] = [
  { x: DOCK.x, y: 142 }, { x: V, y: 142 }, { x: V, y: 118 }, { x: 274, y: 118 }, { x: 274, y: 78 },
  { x: V, y: 78 }, { x: V, y: 82 }, { x: 92, y: 82 }, { x: V, y: 82 }, { x: V, y: 142 }, { x: DOCK.x, y: 142 }, DOCK,
];

/** ang — куда смотрит бампер (радианы); pause — стоит после столкновения до этого времени */
export interface Vacuum {
  x: number; y: number; ang: number; path: Pt[]; at: number; pause: number; humAt: number;
  bumps: number; bumped: Set<Agent>; step: number;
}

let vac: Vacuum | null = null, vacNext = flag('vacuum') ? 10 : FAST ? 60 : rand(2400, 5400);

/** Пылесос в пути (null — стоит на базе). */
export const vacuumNow = () => vac;
/** Глубина для сортировки в кадре (null — стоит на базе, его рисует drawDock). */
export const vacuumDepthY = () => (vac ? vac.y : null);

// реплики только когда не идёт большая сценка и брифинг: пылесос не должен перебивать
const quiet = () => !sceneOn() && !speech.briefTalking;
const anyone = () => { const c = sceneCrew(); return c.length ? pick(c) : null; };

/** Тихий гул щёток: низкий шум, чуть-чуть мотора. */
function hum() {
  if (!audio.ok()) return;
  burst(1.9, 0.016, [filt('lowpass', 240)], 0, 0.35, true);
  tone(118, 1.8, 'triangle', 0.004);
}
/** Писк при выезде с базы (вверх) и при возвращении (вниз). */
const chirp = (up: boolean) => { tone(up ? 880 : 1320, 0.08, 'square', 0.01); tone(up ? 1320 : 880, 0.12, 'square', 0.01, 0.1); };
/** Глухой «бум» бампером. */
function bonk() {
  if (audio.ok()) burst(0.08, 0.06, [filt('lowpass', 420)], 0, 0.003, true);
  tone(240, 0.1, 'square', 0.012, 0, 160);
}

/** Задел ли пылесос кого-то впереди: стоящего или сидящего агента у самого бампера. */
function bumpCheck(v: Vacuum, t: number) {
  if (v.bumps >= MAX_BUMPS) return;
  const hx = Math.cos(v.ang), hy = Math.sin(v.ang);
  for (const a of agents.values()) {
    if (!avail(a) || !arrived(a) || v.bumped.has(a)) continue;
    const dx = a.x - v.x, dy = a.y - v.y;
    if (Math.hypot(dx, dy) > 7 || dx * hx + dy * hy < 0) continue;
    v.bumped.add(a);
    if (Math.random() < 0.4) continue;                       // в этот раз объехал аккуратно
    v.bumps++; v.pause = t + 1.8; v.ang += 0.5; bonk();
    if (quiet()) sceneSay(a, pick(T.vacuum.bump), t);
    return;
  }
}

export function vacuumStep(dt: number, t: number) {
  if (!vac) {
    if (t < vacNext) return;
    if (speech.briefTalking || sceneRegistry.isActive('brief') || !sceneCrew().length) { vacNext = t + (FAST ? 20 : 300); return; }
    vac = { x: DOCK.x, y: DOCK.y, ang: Math.PI / 2, path: ROUTE.map(p => ({ ...p })), at: t, pause: t + 0.6, humAt: 0, bumps: 0, bumped: new Set(), step: 0 };
    presence.vacuum = vac;
    chirp(true);
    return;
  }
  const v = vac, s2 = t - v.at;
  // кто-нибудь замечает: пылесос выехал, а то и с Мурчиком на крыше
  if (v.step === 0 && s2 > 3) {
    v.step = 1;
    const a = anyone();
    if (a && quiet()) { if (presence.catOnVacuum) sceneSay(a, pick(T.vacuum.cat), t); else if (Math.random() < 0.5) sceneSay(a, pick(T.vacuum.start), t); }
  }
  if (t < v.pause) return;
  if (t > v.humAt) { v.humAt = t + 1.6; hum(); }
  const p = v.path[0], dx = p.x - v.x, dy = p.y - v.y, d = Math.hypot(dx, dy);
  // на повороте сначала разворачивается на месте, как настоящий
  if (d > 0.3) {
    let da = Math.atan2(dy, dx) - v.ang;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > 0.06) { v.ang += Math.sign(da) * Math.min(Math.abs(da), 4 * dt); return; }
  }
  const s = SPEED * dt;
  if (d <= s) { v.x = p.x; v.y = p.y; v.path.shift(); } else { v.x += (dx / d) * s; v.y += (dy / d) * s; }
  bumpCheck(v, t);
  if (v.path.length && s2 < 240) return;
  // вернулся на базу (или застрял слишком надолго — тогда просто «дома»)
  vac = null; presence.vacuum = null; chirp(false);
  vacNext = t + (FAST ? 60 : rand(2400, 5400));
  const a = anyone();
  if (a && quiet() && Math.random() < 0.4) sceneSay(a, fill(pick(T.vacuum.home), { n: Math.round(rand(12, 99)) }), t);
}

sceneRegistry.add({ name: 'vacuum', blocks: false, active: () => !!vac, step: vacuumStep });
