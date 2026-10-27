// День тигра (последнее воскресенье сентября): амурский тигр проходит по тротуару, у входа останавливается и рычит (сценка tiger).
import { sfx } from '@/shared/audio';
import { FAST, flag } from '@/shared/lib/flags';
import { W } from '@/shared/lib/pixel/canvas';
import { pick, rand } from '@/shared/lib/random';
import T from '@/shared/i18n/ru/scenes.json';
import { env } from '@/entities/environment';
import { sceneOn, sceneRegistry, speech } from '@/entities/world';
import { sceneCrew, sceneSay } from '@/entities/agent';

/** step: 0 — идёт к офису, 1 — заметили, 2 — стоит у входа, 3 — уходит; said — поздравили */
export interface Tiger { x: number; y: number; step: number; stopAt: number; said: boolean }

let tiger: Tiger | null = null, tigerNext = flag('tiger') ? 15 : rand(300, 900);

/** Тигр на тротуаре (null — нет). */
export const tigerNow = () => tiger;
/** Глубина для сортировки в кадре (null — тигра нет). */
export const tigerDepthY = () => (tiger ? tiger.y : null);

// брифинг старого движка (brief) недоступен: вместо него — его реплики по очереди или сценка 'brief', если зарегистрирована
const busy = () => sceneOn() || speech.briefTalking || sceneRegistry.isActive('brief');
const anyone = () => { const c = sceneCrew(); return c.length ? pick(c) : null; };

export function tigerStep(dt: number, t: number) {
  if (!tiger) {
    if (t < tigerNext) return;
    tigerNext = t + (FAST ? 90 : rand(1500, 2700));
    if (env.holiday !== 'tiger' || busy()) return;
    tiger = { x: -24, y: 174, step: 0, stopAt: 0, said: false };
    return;
  }
  const m = tiger;
  if (m.step === 0 && m.x > 40) { m.step = 1; const a = anyone(); if (a) sceneSay(a, T.tiger.spot, t); sfx.growl(); }
  if (m.step === 1 && m.x >= 186) { m.step = 2; m.stopAt = t; }
  if (m.step === 2) {
    if (t - m.stopAt > 1.2 && !m.said) { m.said = true; const b = anyone(); if (b) sceneSay(b, pick(T.tiger.greet), t); }
    if (t - m.stopAt > 6) m.step = 3;
    return;
  }
  m.x += 16 * dt;
  if (m.x > W + 30) tiger = null;
}

sceneRegistry.add({ name: 'tiger', active: () => !!tiger, step: tigerStep });
