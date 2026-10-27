// Конфетти: push, новый кубок, новая вывеска, премия от руководства.
// Другие фичи запускают его через шину: bus.emit('confetti', { x, y, n }).
import { Q, S, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { pick, rand } from '@/shared/lib/random';
import { bus } from '@/entities/world';

/** бумажка: координаты и скорость в клетках, цвет, сколько ещё летит, фаза мигания */
interface Bit { x: number; y: number; vx: number; vy: number; c: string; life: number; ph: number }

const confettiP: Bit[] = [];
const CONF_COLS = ['#ff5aa0', '#ffcf5c', '#5cc8ff', '#7fe0b4', '#b9a8ff', '#ff8a6b'];

/** n бумажек разлетаются вверх из точки (x, y) в клетках сцены. */
export function confetti(x: number, y: number, n: number) {
  for (let i = 0; i < n; i++) confettiP.push({ x, y, vx: rand(-28, 28), vy: rand(-46, -14), c: pick(CONF_COLS), life: rand(1.4, 2.4), ph: rand(0, 6) });
}
bus.on('confetti', ({ x, y, n }) => confetti(x, y, n));

/** Падают с ускорением, гаснут по времени. */
export function confettiStep(dt: number) {
  for (const p of confettiP) { p.vy += 70 * dt; p.vx *= 1 - dt * 1.5; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
  for (let i = confettiP.length - 1; i >= 0; i--) if (confettiP[i].life <= 0) confettiP.splice(i, 1);
}

/** Бумажки поворачиваются: то узкие, то широкие (мелкие пиксели, в кадр). */
export function drawConfetti(t: number) {
  setTarget(g);
  for (const p of confettiP) Q(p.x * S, p.y * S, ((t * 8 + p.ph) | 0) % 2 ? 2 : 1, 2, p.c);
}
