// Общее для логики и рисования пиццы: где встаёт фургон, его длина, сколько пицца лежит на столе.
import { FAST } from '@/shared/lib/flags';
import type { Car } from '@/entities/car';

/** фургон встаёт так, чтобы боковая дверь была у дорожки к офису */
export const VAN_STOP = 214;
export const VAN_LEN = 58;
/** сколько секунд пицца лежит на кухонном столе: четыре куска, по одному за четверть */
export const PIZZA_TIME = FAST ? 70 : 240;

/** Точка в системе фургона (lx вдоль, ly поперёк) — в клетки сцены с учётом поворота. */
export const local = (v: Car, lx: number, ly: number) => {
  const ang = v.ang ?? 0;
  return { x: v.x + lx * Math.cos(ang) - ly * Math.sin(ang), y: v.y + lx * Math.sin(ang) + ly * Math.cos(ang) };
};
