// Стажёры: субагенты Claude Code приходят от двери и встают у стола своего агента.
// Здесь только тип и рисунок; кто и когда приходит — фича (internStep).
import type { Face, Pt } from '@/entities/world';
import { shade } from '@/shared/lib/color';
import { Q, S, q } from '@/shared/lib/pixel/canvas';
import { KIND } from '../model/kinds';

export interface Intern {
  /** место у стола 0..3: смещение по x задаёт фича */
  slot: number;
  x: number; y: number; dir: Face; ph: number;
  /** уходит к двери: когда дойдёт, фича убирает его из списка */
  leaving: boolean;
  path: Pt[];
}

/** Маленький бот в жёлтой кепке стажёра, в цветах своего агента (t — для единообразия с другими спрайтами). */
export function drawIntern(i: Intern, kind: string, _t: number) {
  const k = KIND[kind] || KIND.claude, X = Math.round(i.x * S), Y = Math.round(i.y * S), T = Y - 14, walk = i.path.length > 0;
  const head = k.head, ol = shade(head, 0.36);
  Q(X - 4, Y - 1, 9, 2, 'rgba(0,0,0,0.25)');
  Q(X - 4, T + 2, 9, 6, ol); Q(X - 3, T + 3, 7, 4, head);
  Q(X - 4, T + 1, 9, 2, '#ffcf5c'); Q(i.dir === 'left' ? X - 6 : X + 3, T + 2, 3, 1, '#e0a030');   // кепка с козырьком
  if (i.dir !== 'up') { Q(X - 2, T + 4, 5, 2, '#1D1A33'); q(X - 1, T + 4, k.eye); q(X + 1, T + 4, k.eye); }
  Q(X - 3, T + 8, 7, 4, k.body); Q(X - 3, T + 8, 7, 1, shade(k.body, 1.3));
  const f = walk ? ((i.ph * 8) | 0) % 2 : 2;
  Q(X - 3, T + 12 + (f === 0 ? 0 : 1), 2, 2, '#2a2540'); Q(X + 1, T + 12 + (f === 1 ? 0 : 1), 2, 2, '#2a2540');
}
