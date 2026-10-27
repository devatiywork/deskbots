// Пицца на кухонном столе: четыре куска, съедаются по одному (мелкие пиксели, в текущий холст кадра).
import { q } from '@/shared/lib/pixel/canvas';
import { PIZZA_TIME } from '../lib/pizza';
import { pizzaUntil } from '../model/pizza';

/** Рисовать, пока pizzaUntil() > t; (cx, cy) — центр в мелких пикселях (на столе — 588, 229). */
export function drawPizza(cx: number, cy: number, t: number) {
  const left = Math.max(1, Math.ceil((pizzaUntil() - t) / (PIZZA_TIME / 4)));
  for (let y = -8; y <= 8; y++) for (let x = -9; x <= 9; x++) {
    const d = Math.hypot(x, y * 1.15); if (d > 8.5) continue;
    const quarter = (x >= 0 ? 0 : 1) + (y >= 0 ? 0 : 2);
    if (quarter >= left) continue;
    q(cx + x, cy + y, d > 7 ? '#c98a3a' : (x * 7 + y * 13) % 11 === 0 ? '#e0453c' : (x + y * 3) % 7 === 0 ? '#fff3c4' : '#ffcf5c');
  }
}
