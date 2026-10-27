// Стажёры: субагенты Claude Code приходят от двери по одному и встают у стола своего агента (не больше четырёх);
// когда субагентов становится меньше, лишние уходят к двери.
import { pick, rand } from '@/shared/lib/random';
import L from '@/shared/i18n/ru/lines.json';
import { V } from '@/entities/world';
import { say, type Agent } from '@/entities/agent';
import { moveAlong } from '@/entities/person';

/** смещение места у стола по x для слотов 0..3 */
const INTERN_DX = [-9, 9, -15, 15];
/** когда пришёл последний стажёр агента: следующий — не раньше чем через 1,5 с */
const internAt = new WeakMap<Agent, number>();

export function internStep(a: Agent, dt: number, t: number) {
  const list = a.interns || (a.interns = []), desk = a.desk;
  const want = desk && !a.leaving && !a.arriving ? Math.min(4, a.subsWant || 0) : 0;
  const stay = list.filter(i => !i.leaving);
  if (desk && stay.length < want && t - (internAt.get(a) || 0) > 1.5) {
    internAt.set(a, t);
    const slot = [0, 1, 2, 3].find(k => !stay.some(i => i.slot === k))!, lane = desk.lane;
    list.push({
      slot, x: 192, y: 159, dir: 'up', ph: rand(0, 6), leaving: false,
      path: [{ x: 192, y: 142 }, { x: V, y: 142 }, { x: V, y: lane }, { x: desk.cx + INTERN_DX[slot], y: lane }],
    });
    if (!stay.length) say(a, pick(L.interns), t, false);
  } else if (stay.length > want) {
    const i = stay.reduce((m, x) => (x.slot > m.slot ? x : m));
    i.leaving = true; i.path = [{ x: V, y: i.y }, { x: V, y: 142 }, { x: 192, y: 142 }, { x: 192, y: 159 }];
  }
  for (const i of list) { moveAlong(i, dt, 30); if (!i.path.length && !i.leaving) i.dir = 'up'; }
  a.interns = list.filter(i => !(i.leaving && !i.path.length));
}
