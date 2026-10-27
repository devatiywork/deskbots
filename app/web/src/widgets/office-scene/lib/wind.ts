// Ветер: сила порыва (качает деревья, гонит капли, гудит в звуке), мерцание света от порывов,
// тонкие линии ветра за зданием и подсветка над крышей с неоном вывески.
import { Q, S, W, glow, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { rand } from '@/shared/lib/random';
import { env } from '@/entities/environment';
import { inBuilding, inSign } from '@/entities/world';
import { agents } from '@/entities/agent';
import { featureState } from './featureState';

/** сила порыва 0..1: её читают деревья, погода и звук */
export const wind = { gust: 0 };

/** Порыв на момент t: волна из двух синусов, при ветре, грозе и тайфуне сильнее. */
export function windNow(t: number) {
  let gust = Math.max(0, 0.25 + 0.75 * Math.sin(t * 0.21) * Math.sin(t * 0.077 + 1));
  if (env.weather === 'wind') gust = Math.max(gust, 0.6 + 0.4 * Math.abs(Math.sin(t * 0.33)));
  if (env.weather === 'storm') gust = Math.max(gust, 0.55 + 0.3 * Math.abs(Math.sin(t * 0.5)));
  if (featureState.typhoon) gust = Math.max(gust, 0.85 + 0.15 * Math.abs(Math.sin(t * 0.7)));
  wind.gust = Math.min(1, gust);
  return wind.gust;
}

/** Мерцание фонарей и подсветки: от порывов и редкий провал. */
export function flicker(t: number) {
  const noise = (Math.sin(t * 17.3) + Math.sin(t * 29.1 + 1) + 2) / 4;
  const dip = (t * 0.7) % 13 < 0.09 ? 0.35 : 0;
  return Math.max(0.45, 1 - wind.gust * 0.3 * noise - dip);
}

interface Streak { x: number; y: number; len: number; v: number; amp: number; ph: number; fr: number }
const streaks: Streak[] = [];
let streakAcc = 0;

export function windStep(dt: number) {
  const gust = wind.gust;
  streakAcc += dt * (0.5 + gust * 2.4) * (env.weather === 'wind' ? 1.6 : 1);
  while (streakAcc > 1) {
    streakAcc--;
    if (streaks.length >= 14) continue;
    const top = Math.random() < 0.6;
    streaks.push({ x: -10 - Math.random() * 30, y: top ? rand(2, 17) : rand(24, 158), len: rand(16, 42), v: rand(70, 130), amp: rand(0.6, 2.4), ph: rand(0, 6), fr: rand(0.1, 0.22) });
  }
  for (const s of streaks) s.x += s.v * dt * (0.6 + gust * 0.8);
  for (let i = streaks.length - 1; i >= 0; i--) if (streaks[i].x - streaks[i].len > W) streaks.splice(i, 1);
}

/** Линии ветра тонкие (в мелкий пиксель) и проходят за зданием и вывеской. */
export function drawStreaks(t: number) {
  const night = env.phase !== 'day', col = night ? '170,215,255' : '255,255,255', base = night ? 0.75 : 0.62;
  for (const s of streaks) for (let i = 0; i < s.len * S; i++) {
    const fx = Math.round(s.x * S - i);
    if (fx < 0 || fx >= W * S) continue;
    const fy = Math.round(s.y * S + Math.sin((fx / S) * s.fr + s.ph + t * 2) * s.amp * S);
    if (inBuilding(fx / S, fy / S) || inSign(fx / S, fy / S)) continue;
    const a = base * (1 - i / (s.len * S)) * Math.min(1, i / 6 + 0.3);
    g.fillStyle = `rgba(${col},${a.toFixed(2)})`; g.fillRect(fx / S, fy / S, 1 / S, 1 / S);
    if (night) { g.fillStyle = `rgba(${col},${(a * 0.25).toFixed(2)})`; g.fillRect(fx / S, (fy - 1) / S, 1 / S, 1 / S); g.fillRect(fx / S, (fy + 1) / S, 1 / S, 1 / S); }
  }
}

/** Подсветка за зданием: мягкое свечение над крышей, мерцает от порывов; неон вывески; кто-то ждёт — вывеска мигает жёлтым. */
export function drawBacklight(t: number) {
  const phase = env.phase, f = featureState.powerOff ? 0 : flicker(t), a = (phase === 'night' ? 0.42 : phase === 'dusk' ? 0.3 : 0.14) * f;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(140,110,255,${(a * (1 - i / 8) * 0.6).toFixed(3)})`; g.fillRect(66 - i, 19 - i, 252 + i * 2, 1); }
  for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(140,110,255,${(a * (1 - i / 5) * 0.35).toFixed(3)})`; g.fillRect(71 - i, 20, 1, 140); g.fillRect(312 + i, 20, 1, 140); }
  // неон вывески
  setTarget(g);
  Q(295, 5, 178, 1, `rgba(255,140,220,${(0.5 * f).toFixed(2)})`); Q(295, 34, 178, 1, `rgba(140,200,255,${(0.5 * f).toFixed(2)})`);
  Q(295, 5, 1, 30, `rgba(255,90,160,${(0.6 * f).toFixed(2)})`); Q(472, 5, 1, 30, `rgba(92,200,255,${(0.6 * f).toFixed(2)})`);
  glow(192, 10, 50, 10, '150,120,255', (phase === 'day' ? 0.06 : 0.16) * f);
  // кто-то ждёт тебя: вывеска мигает жёлтым
  if (f && ((t * 2) | 0) % 2 && [...agents.values()].some(x => x.status === 'waiting' && !x.arriving && !x.leaving)) {
    Q(295, 5, 178, 1, '#ffcf5c'); Q(295, 34, 178, 1, '#ffcf5c'); Q(295, 5, 1, 30, '#ffcf5c'); Q(472, 5, 1, 30, '#ffcf5c');
    glow(192, 10, 50, 10, '255,200,80', 0.22);
  }
  g.globalCompositeOperation = 'source-over';
}
