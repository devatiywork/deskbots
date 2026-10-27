// Поломка кофемашины на кухне: красная лампа, серый дым и облачко «!» над машиной, искры, пока чинят
// (мелкие пиксели, в текущий холст кадра). Рисовать сразу после живого на стенах: машина — часть стены, агенты впереди.
import { Q, discQ, q } from '@/shared/lib/pixel/canvas';
import { coffeeFx } from '../model/coffee';

export function drawCoffeeFx(t: number) {
  const { broken, fixing, fixedAt } = coffeeFx();
  if (!broken) {
    // только что починили: пару секунд лампа горит ярко-зелёным
    if (fixedAt && t - fixedAt < 2.5) { Q(553, 80, 6, 3, 'rgba(127,224,180,0.35)'); Q(554, 81, 4, 1, '#b8ffd8'); }
    return;
  }
  // на экране мигает красная лампа вместо зелёной полоски
  Q(554, 81, 4, 1, ((t * 3) | 0) % 2 ? '#ff5c5c' : '#5a1a24');
  // клубы дыма поднимаются над машиной и тают
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.45 + i / 3) % 1;
    const x = 557 + Math.round(Math.sin(t * 1.3 + i * 2.1) * 2 + p * 5), y = 74 - Math.round(p * 18);
    discQ(x, y, 1 + p * 2.5, `rgba(96,92,118,${(0.6 * (1 - p)).toFixed(2)})`);
  }
  // облачко с красным «!» справа сверху, покачивается
  const by = 60 + Math.round(Math.sin(t * 4));
  Q(569, by, 9, 11, '#1D1A33'); Q(570, by + 1, 7, 9, '#f7f5ff'); Q(569, by + 11, 2, 2, '#1D1A33'); q(570, by + 10, '#f7f5ff');
  Q(572, by + 2, 2, 5, '#e0453c'); Q(572, by + 8, 2, 1, '#e0453c');
  // пока чинят — искры от гаечного ключа
  if (fixing && ((t * 10) | 0) % 3 === 0) for (let i = 0; i < 3; i++) q(552 + Math.random() * 16, 78 + Math.random() * 14, Math.random() < 0.5 ? '#ffcf5c' : '#fff6c8');
}
