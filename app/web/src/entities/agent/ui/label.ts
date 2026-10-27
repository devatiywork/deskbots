// Табличка с именем над головой и значок занятия в белом облачке (мелкие пиксели, текущий холст — кадр).
// Рисуется после всех спрайтов, чтобы таблички не прятались за мебелью.
import { Q, S, q } from '@/shared/lib/pixel/canvas';
import { textQ, textW } from '@/shared/lib/pixel/font';
import { activity, arrived, cafeRight, shortName, sitting, sofaShift, type Agent } from '../model/agent';
import { KIND } from '../model/kinds';

/** маленькие значки 7×5 в белом облачке: что агент сейчас делает */
export const ICON = {
  term:   ['#####..', '#.#....', '#..#...', '#.#....', '#...###'],
  pencil: ['.....##', '....##.', '...##..', '.###...', '##.....'],
  lens:   ['.###...', '#...#..', '#...#..', '.###...', '....##.'],
  cup:    ['.#.#...', '#####..', '#####.#', '######.', '.###...'],
  pad:    ['.#####.', '#.#.#.#', '###.###', '#.#.#.#', '.#####.'],
  chart:  ['......#', '.....#.', '.#.##..', '#.#....', '#######'],
  note:   ['...###.', '...#.#.', '...#.#.', '.###.#.', '.##.##.'],
  phone:  ['.###...', '.#.#...', '.###...', '.###...', '.###...'],
  car:    ['.###...', '#####..', '#####..', '.#.#...', '.......'],
  bang:   ['...#...', '...#...', '...#...', '.......', '...#...'],
  check:  ['......#', '.....#.', '#...#..', '.#.#...', '..#....'],
};
export type IconName = keyof typeof ICON;
export const isIcon = (s: string): s is IconName => s in ICON;

export const ICON_COL: Record<IconName, string> = {
  term: '#1D1A33', pencil: '#cf6f47', lens: '#4A37C9', cup: '#8a5f3f', pad: '#ff5aa0', chart: '#137A4F',
  note: '#4A37C9', phone: '#1D1A33', car: '#c99a1a', bang: '#e0453c', check: '#1f8a55',
};
/** значок по инструменту из хука; у остальных инструментов — бегущие точки */
export const TOOL_ICON: Partial<Record<string, IconName>> = {
  Bash: 'term', Edit: 'pencil', MultiEdit: 'pencil', Write: 'pencil', NotebookEdit: 'pencil',
  Read: 'lens', Grep: 'lens', Glob: 'lens', WebSearch: 'lens', WebFetch: 'lens',
};

/** Облачко со значком; bx, by — левый верхний угол в клетках. */
export function chip(name: IconName, bx: number, by: number, bg = '#f7f5ff') {
  const X = Math.round(bx * S), Y = Math.round(by * S);
  Q(X - 1, Y - 1, 20, 16, '#1D1A33'); Q(X, Y, 18, 14, bg); Q(X, Y + 14, 4, 2, bg); Q(X - 1, Y + 14, 1, 3, '#1D1A33'); Q(X + 4, Y + 14, 1, 2, '#1D1A33'); q(X, Y + 16, '#1D1A33');
  const rows = ICON[name], col = ICON_COL[name];
  for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 7; xx++) if (rows[yy][xx] === '#') Q(X + 2 + xx * 2, Y + 2 + yy * 2, 2, 2, col);
}

/** Табличка с именем: тёмная коробка в неоновой рамке цвета агента; cx — середина, y — верх (в клетках). */
export function neonTag(name: string, cx: number, y: number, col: string) {
  const tw = textW(name) * 2, X = Math.round(cx * S - tw / 2), Y = Math.round(y * S);
  Q(X - 4, Y - 3, tw + 8, 16, '#0e0b1c'); Q(X - 3, Y - 2, tw + 6, 14, col); Q(X - 2, Y - 1, tw + 4, 12, '#17142c');
  textQ(name, X, Y + 1, 2, col);
}

/** Табличка и значок занятия. Запоминает a.labelY — по нему облачка с репликами не налезают друг на друга. */
export function drawLabel(a: Agent, t: number) {
  if (a.arriving) return;
  const k = KIND[a.kind], x = a.x, top = (Math.round(a.y * S) - 22 + (sitting(a) ? 4 : 0)) / S;
  // на диване через одного и за столиком таблички приподняты, чтобы не налезали одна на другую
  const ly = top - 9 - (sofaShift(a) || cafeRight(a) ? 7 : 0);
  a.labelY = ly;
  neonTag(shortName(a), x, ly, k.tag || k.head);
  if (!arrived(a)) return;
  const bx = x + 6, by = top + 1, act = activity(a, t);
  if (a.fxChip && a.fxChip.until > t) {                // упало или получилось
    const n = a.fxChip.name;
    if (isIcon(n)) chip(n, bx, by - ((t * 3 | 0) % 2), n === 'bang' ? '#ffd9d6' : '#dcf7e8');
    return;
  }
  if (act === 'wait') {
    if ((t * 2 | 0) % 2) { const X = Math.round(bx * S), Y = Math.round(by * S); Q(X, Y - 2, 12, 18, '#1D1A33'); Q(X + 1, Y - 1, 10, 16, '#ffcf5c'); Q(X + 5, Y + 1, 2, 8, '#1D1A33'); Q(X + 5, Y + 11, 2, 2, '#1D1A33'); }
  } else if (act === 'work') {
    const ic = TOOL_ICON[a.tool];
    if (ic) chip(ic, bx, by);
    else {
      const X = Math.round(bx * S), Y = Math.round(by * S), n = (t * 3 | 0) % 4;
      Q(X - 1, Y - 1, 20, 14, '#1D1A33'); Q(X, Y, 18, 12, '#f7f5ff'); Q(X, Y + 12, 4, 2, '#f7f5ff');
      for (let i = 0; i < n; i++) Q(X + 3 + i * 4, Y + 5, 2, 2, '#1D1A33');
    }
  } else if (act === 'sleep') {
    const c = (t * 0.7 + a.ph) % 3;
    if (c < 2) textQ('Z', Math.round((bx + c) * S), Math.round((by - c * 2) * S), 2, `rgba(240,236,255,${(1 - c / 2).toFixed(2)})`);
  } else if (act === 'coffee' || act === 'tea') chip('cup', bx, by - ((t * 2 | 0) % 2));
  else if (act === 'game') chip('pad', bx, by - ((t * 4 | 0) % 2));
  else if (act === 'tv') chip('chart', bx, by);
  else if (act === 'music') chip('note', bx, by - ((t * 2 | 0) % 2));
  else if (act === 'phone') chip('phone', bx, by);
  else if (act === 'cab') chip('car', bx, by - ((t * 2 | 0) % 2));
}
