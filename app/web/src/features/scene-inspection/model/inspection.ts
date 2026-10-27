// Пожарная инспекция: инспектор с планшетом заходит, проверяет огнетушитель у двери и спрашивает журнал (сценка inspect).
import { FAST, has } from '@/shared/lib/flags';
import { W } from '@/shared/lib/pixel/canvas';
import { pick, rand } from '@/shared/lib/random';
import { sfx } from '@/shared/audio';
import T from '@/shared/i18n/ru/scenes.json';
import { sceneOn, sceneRegistry, speech } from '@/entities/world';
import { avail, sceneCrew, sceneSay, type Agent } from '@/entities/agent';
import { moveAlong, npc, npcSay, npcs, type Person } from '@/entities/person';

/** идёт к огнетушителю → проверяет и говорит с ближайшим агентом → уходит; a — с кем говорит */
export interface Inspection { o: Person; at: number; state: 'walk' | 'check' | 'out'; step: number; knock?: boolean; a?: Agent }

let inspect: Inspection | null = null, inspectNext = has('inspect') ? 15 : FAST ? 80 : rand(5400, 10800);

/** Идущая инспекция (null — нет). */
export const inspection = () => inspect;

// брифинг старого движка (brief) недоступен: вместо него — его реплики по очереди или сценка 'brief', если зарегистрирована
const busy = () => sceneOn() || speech.briefTalking || sceneRegistry.isActive('brief');

export function inspectStep(dt: number, t: number) {
  if (!inspect) {
    if (t < inspectNext) return;
    if (busy()) { inspectNext = t + 90; return; }
    if (!sceneCrew().length) { inspectNext = t + 300; return; }
    const o = npc('inspector', -10, 174.5, [{ x: 192, y: 174.5 }, { x: 192, y: 166 }, { x: 192, y: 156 }, { x: 187, y: 156 }]);
    o.pad = true;
    inspect = { o, at: t, state: 'walk', step: 0 };
    return;
  }
  const s = inspect, o = s.o, s2 = t - s.at;
  if (s.state === 'walk') {
    if (!s.knock && o.x >= 191.5) { s.knock = true; npcSay(o, T.inspect.knock, t); sfx.door(); }
    if (moveAlong(o, dt, 26)) {
      o.dir = 'left'; s.state = 'check'; s.at = t;
      s.a = sceneCrew().sort((x, y) => Math.hypot(x.x - o.x, x.y - o.y) - Math.hypot(y.x - o.x, y.y - o.y))[0];
    }
    return;
  }
  if (s.state === 'check') {
    const a = s.a && avail(s.a) ? s.a : null;
    // в старом движке эти реплики звались без t и облачко не гасло; здесь — с текущим временем
    const line = (n: number, at: number, fn: () => void) => { if (s.step < n && s2 > at) { s.step = n; fn(); } };
    line(1, 0.6, () => sceneSay(a, pick(T.inspect.hi), t));
    line(2, 4.2, () => npcSay(o, T.inspect.extinguisher, t));
    line(3, 8.4, () => npcSay(o, T.inspect.journal, t));
    line(4, 12, () => sceneSay(a, pick(T.inspect.answer), t));
    line(5, 15.5, () => npcSay(o, pick(T.inspect.verdict), t));
    if (s2 > 19) { o.path = [{ x: 192, y: 156 }, { x: 192, y: 166 }, { x: 192, y: 174.5 }, { x: W + 12, y: 174.5 }]; s.state = 'out'; }
    return;
  }
  if (moveAlong(o, dt, 30)) { npcs.splice(npcs.indexOf(o), 1); inspect = null; inspectNext = t + (FAST ? 150 : rand(7200, 14400)); }
}

sceneRegistry.add({ name: 'inspect', active: () => !!inspect, step: inspectStep });
