// Чайки: стайки пролетают над двором; изредка одна кружит над офисом и высматривает пончики (сценка gull).
import { sfx } from '@/shared/audio';
import { FAST, has } from '@/shared/lib/flags';
import { W } from '@/shared/lib/pixel/canvas';
import { pick, rand } from '@/shared/lib/random';
import T from '@/shared/i18n/ru/scenes.json';
import { env, isWet } from '@/entities/environment';
import { sceneOn, sceneRegistry, speech } from '@/entities/world';
import { sceneCrew, sceneSay, type Agent } from '@/entities/agent';

/** птица из стайки: летит поперёк двора и чуть покачивается */
export interface Gull { x: number; y: number; dir: number; v: number; ph: number }
/** чайка сценки: a её заметил, b отвечает; sx — куда смотрит (1 — вправо) */
export interface BigGull { at: number; a: Agent; b: Agent; step: number; x: number; y: number; sx: number }

export const gulls: Gull[] = [];
let gullAmbient = 8, gull: BigGull | null = null, gullNext = has('gull') ? 15 : FAST ? 40 : rand(600, 1500);

/** Чайка сценки (null — не прилетала). */
export const bigGull = () => gull;

// брифинг старого движка (brief) недоступен: вместо него — его реплики по очереди или сценка 'brief', если зарегистрирована
const busy = () => sceneOn() || speech.briefTalking || sceneRegistry.isActive('brief');
const ease = (p: number) => 1 - Math.pow(1 - p, 3);

export function gullStep(dt: number, t: number) {
  if (t > gullAmbient) {
    if (!isWet() && env.weather !== 'snow' && env.phase !== 'night') {
      const dir = Math.random() < 0.5 ? 1 : -1, n = 1 + ((Math.random() * 3) | 0), y0 = rand(4, 28);
      for (let i = 0; i < n; i++) gulls.push({ x: dir > 0 ? -12 - i * 9 : W + 12 + i * 9, y: y0 + rand(-3, 5) + i * 3, dir, v: rand(24, 38), ph: rand(0, 6) });
    }
    gullAmbient = t + (FAST ? rand(8, 16) : rand(30, 80));
  }
  for (const b of gulls) { b.x += b.dir * b.v * dt; b.y += Math.sin(t * 0.8 + b.ph) * 2 * dt; }
  for (let i = gulls.length - 1; i >= 0; i--) if (gulls[i].x < -30 || gulls[i].x > W + 30) gulls.splice(i, 1);
  if (!gull) {
    if (t < gullNext) return;
    if (busy()) { gullNext = t + 60; return; }
    const here = sceneCrew();
    if (!here.length) { gullNext = t + 120; return; }
    const a = pick(here), rest = here.filter(x => x !== a), b = rest.length ? pick(rest) : a;
    gull = { at: t, a, b, step: 0, x: -20, y: 22, sx: 1 };
    sceneSay(a, T.gull.spot, t); sfx.gull();
    return;
  }
  // подлетает, полтора круга над офисом, улетает вправо вверх
  const m = gull, s2 = t - m.at, CX = 192, CY = 13, RX = 64, RY = 7;
  const line = (n: number, at: number, who: Agent, text: string, snd?: () => void) => { if (m.step < n && s2 > at) { m.step = n; sceneSay(who, text, t); snd?.(); } };
  line(1, 3, m.b, pick(T.gull.look));
  line(2, 7.5, m.a, pick(T.gull.shoo), () => sfx.gull());
  line(3, 13, m.b, pick(T.gull.gone));
  if (s2 < 4) { const p = ease(s2 / 4); m.x = -20 + (CX - RX + 20) * p; m.y = 22 + (CY - 22) * p; m.sx = 1; }
  else if (s2 < 12) { const ang = Math.PI + ((s2 - 4) / 8) * Math.PI * 3; m.x = CX + Math.cos(ang) * RX; m.y = CY + Math.sin(ang) * RY; m.sx = -Math.sin(ang) >= 0 ? 1 : -1; }
  else { const p = Math.min(1, (s2 - 12) / 3.5); m.x = CX + RX + (W + 40 - CX - RX) * p * p; m.y = CY - 22 * p * p; m.sx = 1; }
  if (s2 > 15.5) { gull = null; gullNext = t + (FAST ? 90 : rand(2400, 5400)); }
}

sceneRegistry.add({ name: 'gull', active: () => !!gull, step: gullStep });
