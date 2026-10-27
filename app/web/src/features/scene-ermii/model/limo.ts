// Лимузин Grand Ermii: подъезжает ко входу, стоит с открытой дверью, уезжает. Пока он на улице,
// бордюр занят (traffic.reserved): свои машины агентов не приезжают.
import { sfx } from '@/shared/audio';
import { RIDE, STOP_X, cars, traffic, type Car, type RideCar } from '@/entities/car';

let limo: RideCar | null = null;
/** лимузин руководства, пока он на улице */
export const limoNow = () => limo;

export function callLimo(t: number) {
  limo = { ride: 'limo', ermii: true, x: -50, dir: 1, y: 192, v: 70, col: RIDE.limo.col, len: RIDE.limo.len, state: 'come', at: t };
  cars.push(limo);
  traffic.reserved = limo;
}

/** Тормозит у входа и сигналит; уезжая, разгоняется. Уехал за край — бордюр свободен. */
export function limoStep(dt: number, t: number) {
  const c = limo;
  if (!c) return;
  if (c.state === 'come') {
    const d = STOP_X - c.x; c.v = Math.max(5, Math.min(70, d * 1.6));
    if (d <= 0.3) { c.x = STOP_X; c.v = 0; c.state = 'stop'; c.at = t; sfx.horn('limo'); }
  } else if (c.state === 'go') {
    c.door = false; c.v = Math.min(80, c.v + 45 * dt);
    if (!cars.includes(c)) { limo = null; if (traffic.reserved === c) traffic.reserved = null; }
  }
}

/** Дверь лимузина: открылась — хлопок, закрылась — хлопок. */
export const limoDoor = (c: Car, open: boolean) => { if (!!c.door !== open) sfx.door(); c.door = open; };
