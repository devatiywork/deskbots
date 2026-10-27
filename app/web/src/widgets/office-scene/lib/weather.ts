// Погода в кадре: дождь с брызгами и кругами на лужах, гроза с молниями, снег, туман,
// ветер с листьями или лепестками (зимой — позёмка). В здание осадки не залетают, кроме окон.
import { H, S, W } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { shade } from '@/shared/lib/color';
import { pick, rand } from '@/shared/lib/random';
import { sfx } from '@/shared/audio';
import LINES from '@/shared/i18n/ru/lines.json';
import { env, isWet } from '@/entities/environment';
import { PUDDLES, inBuilding, inWindow } from '@/entities/world';
import { agents, arrived, say } from '@/entities/agent';
import { wind } from './wind';

/** капля, снежинка, позёмка или лист; при перезапуске поля обновляются на месте (Object.assign) */
interface Drop {
  type: 'rain' | 'snow' | 'drift' | 'leaf';
  x: number; y: number; v: number;
  /** где капля падает на землю */
  end?: number;
  ph?: number;
  big?: boolean;
  col?: string;
}
interface Splash { x: number; y: number; life: number }
interface Ripple { x: number; y: number; r: number }

const drops: Drop[] = [], splashes: Splash[] = [], ripples: Ripple[] = [];
let flash = 0, nextFlash = 0, flash2 = 0;
const fogBands = Array.from({ length: 7 }, (_, i) => ({ x: rand(-60, W), y: 10 + i * 30 + rand(-8, 8), rx: rand(50, 90), ry: rand(9, 16), v: rand(3, 7) }));

/** Сила дождя или снега плавно меняется, но не пропадает. */
export function weatherK(t: number) { return 0.55 + 0.45 * Math.sin(t / 70); }
/** Новая погода набирает силу ~12 с. */
export const ramp = (t: number) => Math.min(1, Math.max(0, (t - env.weatherSince) / 12));

/** Сменилась погода или сезон: старые капли и круги убираются (перед перерисовкой фона). */
export function clearWeather() { drops.length = 0; splashes.length = 0; ripples.length = 0; }

export function weatherStep(dt: number, t: number) {
  if (!env.weatherSince) env.weatherSince = t;
  const { weather, season } = env, gust = wind.gust;
  const k = weatherK(t), rp = ramp(t);
  const want = Math.round(rp * ({
    rain: 150 * k, storm: 280, snow: 140 * k, fog: 0,
    wind: season === 'winter' ? 90 : 45,
    clear: season === 'spring' ? 14 : season === 'autumn' ? 12 : 0,
  })[weather]);
  while (drops.length < want) drops.push(newDrop(true));
  if (drops.length > want) drops.length = want;
  const storm = weather === 'storm';
  for (const d of drops) {
    if (d.type === 'rain') {
      d.y += d.v * dt; d.x += (gust * 40 + (storm ? 50 : 0)) * dt;
      if (d.y > d.end!) { if (!inBuilding(d.x, d.end!)) splashes.push({ x: d.x, y: d.end!, life: 0.18 }); Object.assign(d, newDrop(false)); }
    } else if (d.type === 'snow') {
      d.y += d.v * dt; d.x += (Math.sin(t * 1.3 + d.ph!) * 6 + gust * 16) * dt;
      if (d.y > H + 2 || d.x > W + 4) Object.assign(d, newDrop(false));
    } else if (d.type === 'drift') {
      d.x += ((50 + gust * 90) * dt * d.v) / 20; d.y += (4 + Math.sin(t * 3 + d.ph!) * 8) * dt;
      if (d.x > W + 4 || d.y > H + 4) Object.assign(d, newDrop(false), { x: -4, y: rand(0, H) });
    } else {
      const wk = weather === 'wind' ? 1.7 : 1;
      d.x += ((25 + gust * 70) * wk * dt * d.v) / 20; d.y += (8 + Math.sin(t * 2 + d.ph!) * 14) * dt;
      if (d.x > W + 4 || d.y > H + 4) Object.assign(d, newDrop(false), { x: -4, y: rand(0, H) });
    }
  }
  for (const s of splashes) s.life -= dt;
  for (let i = splashes.length - 1; i >= 0; i--) if (splashes[i].life <= 0) splashes.splice(i, 1);
  if (isWet()) {
    if (Math.random() < dt * 6 * k * rp) { const [x, y, s] = pick(PUDDLES); ripples.push({ x: x + rand(-s + 2, s - 2), y: y + rand(-1, 1), r: 0 }); }
    for (const r of ripples) r.r += dt * 5;
    for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i].r > 3.5) ripples.splice(i, 1);
  } else ripples.length = 0;
  // гроза: вспышка молнии каждые 7–18 секунд, иногда двойная; кто-нибудь из агентов реагирует
  flash = Math.max(0, flash - dt * 3.2);
  if (storm && rp > 0.5) {
    if (!nextFlash) nextFlash = t + rand(3, 8);
    if (t > nextFlash) {
      flash = 1; nextFlash = t + rand(7, 18); flash2 = Math.random() < 0.5 ? t + 0.22 : 0; sfx.thunder(rand(0.2, 1.4));
      const near = [...agents.values()].filter(a => !a.arriving && arrived(a) && !a.leaving);
      if (near.length && Math.random() < 0.45) say(pick(near), pick(LINES.flash), t, false);
    }
    if (flash2 && t > flash2) { flash = 0.8; flash2 = 0; }
  } else nextFlash = 0;
  for (const f of fogBands) { f.x += f.v * dt * (1 + gust); if (f.x - f.rx > W) { f.x = -f.rx - rand(0, 40); f.y = rand(5, 205); } }
}

export function newDrop(first: boolean): Drop {
  const { weather, season } = env;
  const x = rand(-40, W), y = first ? rand(0, H) : rand(-30, -4);
  if (isWet()) return { type: 'rain', x, y, v: rand(170, 230) * (weather === 'storm' ? 1.25 : 1), end: rand(0, H) };
  if (weather === 'snow') return { type: 'snow', x, y, v: rand(10, 26), ph: rand(0, 6), big: Math.random() < 0.18 };
  if (season === 'winter') return { type: 'drift', x: rand(0, W), y: rand(0, H), v: rand(14, 28), ph: rand(0, 6) };
  const col = season === 'autumn' ? ['#d06a2c', '#eeb03a', '#9c3f2b', '#e0745f'] : season === 'spring' ? ['#ffb3cf', '#ffd6e6', '#ffffff'] : ['#4f9c5c', '#7fc46a', '#357d44'];
  return { type: 'leaf', x: rand(0, W), y: rand(0, H), v: rand(14, 28), ph: rand(0, 6), col: pick(col) };
}

/** Видно ли точку: на улице или в окне. */
export const visible = (x: number, y: number) => !inBuilding(x, y) || inWindow(x, y);

export function drawWeather(t: number) {
  const night = env.phase === 'night', sx = (wind.gust * 0.7 + (env.weather === 'storm' ? 0.6 : 0)) * S;
  const dot = (fx: number, fy: number, w = 1, h = 1) => g.fillRect(Math.round(fx) / S, Math.round(fy) / S, w / S, h / S);
  g.fillStyle = night ? 'rgba(170,195,255,0.7)' : 'rgba(225,238,255,0.8)';
  for (const d of drops) if (d.type === 'rain') {
    const X = d.x * S, Y = d.y * S;
    for (let i = 0; i < 9; i++) { const px = X - (sx * i) / 2, py = Y - i * 1.3; if (visible(px / S, py / S)) dot(px, py); }
  }
  g.fillStyle = 'rgba(220,235,255,0.7)';
  for (const s of splashes) { dot(s.x * S - 2, s.y * S - 1); dot(s.x * S + 2, s.y * S - 1); dot(s.x * S, s.y * S); }
  g.fillStyle = 'rgba(200,220,255,0.45)';
  for (const r of ripples) { const rr = r.r * S, X = r.x * S, Y = r.y * S; dot(X - rr, Y); dot(X + rr, Y); dot(X, Y - rr * 0.4); dot(X, Y + rr * 0.4); }
  for (const d of drops) {
    if (d.type === 'rain' || !visible(d.x, d.y)) continue;
    const X = d.x * S, Y = d.y * S;
    if (d.type === 'snow' || d.type === 'drift') {
      g.fillStyle = d.big ? '#ffffff' : 'rgba(255,255,255,0.85)';
      if (d.big) { dot(X - 1, Y); dot(X + 1, Y); dot(X, Y - 1); dot(X, Y + 1); dot(X, Y); } else dot(X, Y, d.type === 'drift' ? 2 : 1, 1);
    } else {
      g.fillStyle = d.col!;
      if (((t * 4 + d.ph!) | 0) % 2) dot(X, Y, 3, 2); else dot(X, Y, 2, 3);
      g.fillStyle = shade(d.col!, 0.7); dot(X + 1, Y + 1);
    }
  }
}

/** Туман: медленные полосы над улицей, в здание не заходят. */
export function drawFog(t: number) {
  if (env.weather !== 'fog') return;
  const rp = ramp(t), col = env.phase === 'night' ? '120,128,170' : '228,232,242';
  g.save();
  g.beginPath(); g.rect(0, 0, W, H); g.rect(72, 20, 240, 144); g.clip('evenodd');
  g.fillStyle = `rgba(${col},${(0.24 * rp).toFixed(3)})`; g.fillRect(0, 0, W, H);
  for (const f of fogBands) {
    const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.rx);
    gr.addColorStop(0, `rgba(${col},${(0.6 * rp).toFixed(3)})`); gr.addColorStop(1, `rgba(${col},0)`);
    g.save(); g.translate(f.x, f.y); g.scale(1, f.ry / f.rx); g.translate(-f.x, -f.y);
    g.fillStyle = gr; g.fillRect(f.x - f.rx, f.y - f.rx, f.rx * 2, f.rx * 2); g.restore();
  }
  g.restore();
}

/** Вспышка молнии на весь кадр. */
export function drawFlash() {
  if (flash <= 0) return;
  g.fillStyle = `rgba(225,230,255,${(flash * 0.5).toFixed(3)})`; g.fillRect(0, 0, W, H);
}
