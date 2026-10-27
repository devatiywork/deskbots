// Машины на улице: поток в обе стороны и свои машины агентов. Claude ездит на белой Тесле, ChatGPT на лимузине,
// Codex на такси. Своя машина привозит агента ко входу и забирает уходящих у бордюра.
// Фургон с пиццей и лимузин Grand Ermii — машины сценок: тоже лежат в cars, но ими управляют фичи.
import { sfx } from '@/shared/audio';
import { has } from '@/shared/lib/flags';
import { W } from '@/shared/lib/pixel/canvas';
import { pick } from '@/shared/lib/random';
import { bus, later } from '@/entities/world';
import { agents, atCurb, type Agent, type Ride } from '@/entities/agent';

export interface Car {
  x: number; y: number;
  /** 1 — вправо по ближней полосе (y 192), −1 — влево по дальней (y 208) */
  dir: number;
  /** скорость, с которой хочет ехать; cur — с которой едет (за стоящей машиной ждёт) */
  v: number; cur?: number;
  /** длина в мелких пикселях */
  len: number;
  col: string;
  // своя машина агента или лимузин руководства: подъезжает, стоит у входа с открытой дверью, уезжает
  ride?: Ride; state?: 'come' | 'stop' | 'go'; at?: number; busy?: number; door?: boolean; ermii?: boolean;
  /** едет сам (фургон с пиццей): поток его не двигает */
  van?: boolean; ang?: number; side?: boolean;
  /** свой рисунок вместо обычной машины (фургон) */
  draw?: (c: Car, t: number) => void;
}
/** Машина, которая останавливается у входа. */
export interface RideCar extends Car { ride: Ride; state: 'come' | 'stop' | 'go'; at: number }

export const cars: Car[] = [];
let nextCar = 1;
export const CAR_COLORS = ['#e0745f', '#5cc8ff', '#f7f5ff', '#7b61ff', '#2fd3a0', '#4a4560', '#ff9ab8'];
/** где машина останавливается у входа */
export const STOP_X = 192;
// у каждого своя машина: Claude ездит на белой Тесле, ChatGPT на лимузине, Codex на такси
const RIDE_OF: Partial<Record<string, Ride>> = { claude: 'tesla', 'claude-app': 'tesla', chatgpt: 'limo', codex: 'taxi' };
export const RIDE: Record<Ride, { col: string; len: number }> = { taxi: { col: '#ffc83a', len: 44 }, tesla: { col: '#eef0f5', len: 46 }, limo: { col: '#1c1a24', len: 86 } };
const RIDES = Object.keys(RIDE) as Ride[];
// ChatGPT на лимузине примерно в каждый четвёртый приезд, в остальные на такси
const pickRide = (kind: string): Ride => (kind === 'chatgpt' ? (Math.random() < 0.25 || has('limo') ? 'limo' : 'taxi') : RIDE_OF[kind] || 'taxi');
/** На чём агент ездит: выбирается один раз и запоминается в a.ride. */
export const rideOf = (a: Agent): Ride => a.ride || (a.ride = pickRide(a.kind));
/** машины агентов, которые сейчас на улице: не больше одной каждого вида */
export const rides: Partial<Record<Ride, RideCar>> = {};

/**
 * Бордюр у входа занят машиной сценки (лимузин Grand Ermii): свои машины агентов не приезжают.
 * Фича визита ставит сюда свою машину и убирает, когда та уехала за край.
 */
export const traffic = { reserved: null as object | null };

/** На ближней полосе между x0 и x1 нет машин. */
export const laneFree = (x0: number, x1: number) => !cars.some(c => Math.abs(c.y - 192) < 5 && c.x > x0 && c.x < x1);
const rideNeeded = (type: Ride) => [...agents.values()].some(a => rideOf(a) === type && (a.arriving || atCurb(a)));

function rideStep(type: Ride, dt: number, t: number) {
  const r = rides[type];
  if (!r) {
    if (rideNeeded(type) && laneFree(-90, -5) && !traffic.reserved) {
      const c: RideCar = { ride: type, x: -40, dir: 1, y: 192, v: 70, col: RIDE[type].col, len: RIDE[type].len, state: 'come', at: 0 };
      rides[type] = c; cars.push(c);
    }
    return;
  }
  if (r.state === 'come') {
    const d = STOP_X - r.x;
    r.v = Math.max(5, Math.min(70, d * 1.6));
    if (d <= 0.3) { r.x = STOP_X; r.v = 0; r.state = 'stop'; r.at = t; sfx.horn(type); }
  } else if (r.state === 'stop') {
    // выпускаем приехавших по одному, сажаем тех, кто ждёт у бордюра
    const s2 = t - r.at, mine = [...agents.values()].filter(a => rideOf(a) === type);
    let n = 0;
    if (s2 > 0.8) for (const a of mine) {
      if (a.arriving) {
        if (!a.exitAt) a.exitAt = t + 0.7 * n++;
        if (t >= a.exitAt) {
          a.arriving = false; a.exitAt = 0; a.x = 192; a.y = 181; a.nextSay = Math.max(a.nextSay, t + 3); r.busy = t;
          bus.emit('agent-arrived', { agent: a, t });         // приветствие после отлучки, кот встречает — у подписчиков
          later(t + 0.7, () => sfx.bell());                 // дошёл до двери офиса
        }
      } else if (atCurb(a)) { agents.delete(a.id); r.busy = t; }
    }
    const door = s2 > 0.35 && t - (r.busy || r.at + 0.8) < 1.4;
    if (door !== !!r.door) sfx.door();
    r.door = door;
    // ждём ещё немного, если кто-то уже идёт к выходу
    const waiting = mine.some(a => a.arriving || atCurb(a)), coming = mine.some(a => a.leaving && !atCurb(a));
    if (s2 > 2.6 && !waiting && t - (r.busy || 0) > 1.4 && !(coming && s2 < 8)) r.state = 'go';
  } else {
    r.door = false; r.v = Math.min(80, r.v + 45 * dt);
  }
}

/** Шаг улицы: новые машины потока, свои машины агентов, движение без наездов, уехавшие за край убираются. */
export function carStep(dt: number, t: number) {
  if (t > nextCar) {
    const dir = Math.random() < 0.5 ? 1 : -1, x = dir > 0 ? -30 : W + 30, y = dir > 0 ? 192 : 208;
    if (!cars.some(c => c.y === y && Math.abs(c.x - x) < 50)) cars.push({ x, dir, y, col: pick(CAR_COLORS), v: 45 + Math.random() * 30, len: 44 });
    nextCar = t + 4 + Math.random() * 9;
  }
  for (const type of RIDES) rideStep(type, dt, t);
  // машины в одном ряду не наезжают друг на друга и ждут за стоящей машиной
  for (const c of cars) {
    if (c.van) continue;                               // фургон с пиццей едет сам
    let v = c.v;
    for (const o of cars) if (o !== c && Math.abs(o.y - c.y) < 5) {
      const gap = (o.x - c.x) * c.dir, need = (c.len + o.len) / 4 + 6;
      if (gap > 0 && gap < need + 4) v = Math.min(v, gap < need ? 0 : o.v);
    }
    c.cur = v; c.x += c.dir * v * dt;
  }
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (c.x < -50 || c.x > W + 50) { if (c.ride && rides[c.ride] === c) delete rides[c.ride]; cars.splice(i, 1); }
  }
}
