// Защита OLED: раз в 2 минуты вся картинка сдвигается на пару пикселей по кругу.
import { config, view } from '@/entities/world';

export const ORBIT: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]];

/** Сдвиг картинки на экране [x, y] в пикселях холста; без защиты OLED — [0, 0]. */
export const orbit = (): [number, number] => {
  if (!config.oled) return [0, 0];
  const [x, y] = ORBIT[((Date.now() / 120e3) | 0) % ORBIT.length], k = 2 * Math.max(1, Math.round(view.dpr));
  return [x * k, y * k];
};
