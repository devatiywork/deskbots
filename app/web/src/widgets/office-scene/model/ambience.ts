// Фоновые звуки офиса: дождь, гул, ветер, улица; клавиатуры работающих агентов; аркада, храп, вибрация телефона;
// кукушка в часах каждый час, сверчки тёплой ночью, птицы весной и летом, ревун маяка в тумане.
import { activity, agents, arrived } from '@/entities/agent';
import { cars } from '@/entities/car';
import { env, isGrey, isWet, localNow } from '@/entities/environment';
import { audio, sfx } from '@/shared/audio';
import { W } from '@/shared/lib/pixel/canvas';
import { rand } from '@/shared/lib/random';
import { ramp, weatherK, wind } from '../lib';

const next = { cricket: 0, bird: 0, horn: 20, hour: localNow().h };

/** generator — у отключения света заработал генератор: гул громче. */
export function ambienceStep(dt: number, t: number, generator: boolean) {
  const beds = audio.beds, ctx = audio.ctx;
  if (!audio.ok() || !beds || !ctx) return;
  const at = ctx.currentTime, set = (gn: GainNode, v: number) => gn.gain.setTargetAtTime(v, at, 0.6), rp = ramp(t), w = env.weather;
  set(beds.rain, isWet() ? (w === 'storm' ? 0.22 : 0.12) * rp * weatherK(t) : 0);
  set(beds.rumble, 0.035 + (w === 'storm' ? 0.08 : 0) + (generator ? 0.1 : 0));
  set(beds.wind, 0.04 + wind.gust * (w === 'wind' ? 0.3 : w === 'storm' ? 0.2 : 0.1));
  beds.windF.frequency.setTargetAtTime(300 + wind.gust * 500 + Math.sin(t * 0.7) * 80, at, 0.3);
  let tr = 0;
  for (const c of cars) tr += (Math.max(0, 1 - Math.abs(c.x - W / 2) / 170) * (c.cur ?? c.v)) / 70;
  set(beds.traffic, Math.min(0.22, tr * 0.11));
  // клавиатуры работающих агентов
  const typing = [...agents.values()].filter(a => a.status === 'working' && arrived(a) && a.place === a.desk && !a.brk).length;
  if (typing && Math.random() < dt * typing * 5) sfx.key();
  // аркада пиликает, на диване храпят, в кармане вибрирует телефон
  for (const a of agents.values()) {
    if (t < (a.sndAt || 0)) continue;
    const act = activity(a, t);
    if (act === 'game') { sfx.arcade(); a.sndAt = t + rand(5, 11); }
    else if (act === 'sleep') { sfx.snore(); a.sndAt = t + rand(3.5, 6); }
    else if (act === 'phone') { sfx.vibe(); a.sndAt = t + rand(20, 45); }
    else a.sndAt = t + 2;
  }
  // часы на стене кукуют в начале каждого часа, ночью молчат
  const k = localNow();
  if (k.m === 0 && k.h !== next.hour && k.h >= 8 && k.h < 23) sfx.cuckoo();
  next.hour = k.h;
  // сверчки тёплой ночью, птицы ясным днём весной и летом
  if (env.phase === 'night' && env.season !== 'winter' && !isWet() && w !== 'snow') {
    if (t > next.cricket) { sfx.cricket(); next.cricket = t + rand(0.5, 1.8); }
  } else if (env.phase === 'day' && (env.season === 'spring' || env.season === 'summer') && !isGrey()) {
    if (t > next.bird) { sfx.bird(); next.bird = t + rand(4, 12); }
  }
  if (w === 'fog' && t > next.horn) { sfx.foghorn(); next.horn = t + rand(50, 110); }
}
