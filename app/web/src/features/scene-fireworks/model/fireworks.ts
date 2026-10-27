// Салют в окнах: новогодняя ночь и День города (2 июля) или #fireworks. Другим сценкам не мешает.
import { sfx } from '@/shared/audio';
import { flag } from '@/shared/lib/flags';
import { pick, rand } from '@/shared/lib/random';
import L from '@/shared/i18n/ru/lines.json';
import { env } from '@/entities/environment';
import { WINDOWS, sceneRegistry } from '@/entities/world';
import { say, sceneCrew } from '@/entities/agent';

/** вспышка: центр в мелких пикселях, когда взорвалась, цвет, сколько искр */
export interface Burst { x: number; y: number; at: number; c: string; n: number }

// те же цвета, что у конфетти
const COLORS = ['#ff5aa0', '#ffcf5c', '#5cc8ff', '#7fe0b4', '#b9a8ff', '#ff8a6b'];

export const fw: Burst[] = [];
let fwNext = 0, fwSaid = 0;

/** Сейчас салют: ночь 31 декабря с 22:00 до 3:00 1 января, вечер 2 июля с 21:00. */
export function fireworksOn(): boolean {
  if (flag('fireworks')) return true;
  if (env.phase !== 'night') return false;
  const d = new Date(), m = d.getMonth() + 1, day = d.getDate(), h = d.getHours();
  return (m === 12 && day === 31 && h >= 22) || (m === 1 && day === 1 && h < 3) || (m === 7 && day === 2 && h >= 21);
}

export function fireworksStep(_dt: number, t: number) {
  if (fireworksOn() && t > fwNext) {
    fwNext = t + rand(0.8, 2.2);
    fw.push({ x: pick(WINDOWS) * 2 + 1 + rand(6, 44), y: rand(56, 66), at: t, c: pick(COLORS), n: 10 + ((Math.random() * 6) | 0) });
    sfx.firework();
    // кто-нибудь радуется, не чаще раза в полторы минуты
    if (t > fwSaid) { fwSaid = t + 90; const c = sceneCrew(); if (c.length) say(pick(c), pick(L.fireworks), t, false); }
  }
  for (let i = fw.length - 1; i >= 0; i--) if (t - fw[i].at > 1.6) fw.splice(i, 1);
}

sceneRegistry.add({ name: 'fireworks', active: () => fw.length > 0, blocks: false, step: fireworksStep });
