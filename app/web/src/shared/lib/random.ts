// Случайности: равномерное число, случайный элемент, генератор с зерном (для одинакового фона при каждой отрисовке).

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];
export const shuffle = <T,>(arr: readonly T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

/** Генератор mulberry32: одно и то же зерно — одна и та же последовательность. */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
