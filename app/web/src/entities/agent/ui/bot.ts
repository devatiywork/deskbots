// Рисование бота в мелких пикселях: голова, антенна, тело, руки, кружка или телефон, ноги.
// Ollama — лама в наушниках и чёрном худи. Рисует в текущий холст (кадр).
import { env } from '@/entities/environment';
import type { Face } from '@/entities/world';
import { shade } from '@/shared/lib/color';
import { Q, S, q } from '@/shared/lib/pixel/canvas';
import { activity, sitting, type Agent } from '../model/agent';
import { KIND } from '../model/kinds';

/** голова ламы Ollama: пушистая шерсть, ушки, синие наушники с огоньком */
export const LLAMA = { w: '#f6e7d2', wl: '#fff6ea', wd: '#dcc3a5', ol: '#6b5444', pink: '#f2a5ae', cup: '#262a66', glow: '#5b8cff', band: '#1d2050' };

export function llamaHead(X: number, T: number, dir: Face, eyeOpen: boolean, talk: boolean, t: number) {
  const L = LLAMA;
  const ear = (x: number) => { Q(x, T - 3, 3, 1, L.ol); Q(x - 1, T - 2, 1, 6, L.ol); Q(x + 3, T - 2, 1, 6, L.ol); Q(x, T - 2, 3, 6, L.w); if (dir !== 'up') Q(x + 1, T - 1, 1, 4, L.pink); };
  if (dir === 'left') ear(X); else if (dir === 'right') ear(X - 3); else { ear(X - 6); ear(X + 4); }
  // пушистая голова: контур, шерсть, светлые пряди сверху
  Q(X - 7, T + 3, 15, 1, L.ol); Q(X - 7, T + 13, 15, 1, L.ol); Q(X - 8, T + 4, 1, 9, L.ol); Q(X + 8, T + 4, 1, 9, L.ol);
  Q(X - 7, T + 4, 15, 9, L.w); Q(X - 7, T + 12, 15, 1, L.wd); Q(X + 7, T + 5, 1, 7, L.wd);
  for (let i = 0; i < 5; i++) Q(X - 6 + i * 3, T + 2 + (i % 2), 2, 2, L.wl);
  // дужка наушников
  Q(X - 6, T + 1, 13, 1, L.band); Q(X - 8, T + 2, 2, 1, L.band); Q(X + 7, T + 2, 2, 1, L.band);
  const glow = (t * 2 | 0) % 2 ? L.glow : '#7fa6ff';
  if (dir === 'down' || dir === 'up') {
    Q(X - 10, T + 5, 3, 6, L.cup); Q(X - 10, T + 6, 1, 4, glow); Q(X + 8, T + 5, 3, 6, L.cup); Q(X + 10, T + 6, 1, 4, glow);
  }
  if (dir === 'down') {
    if (eyeOpen) { Q(X - 4, T + 7, 2, 2, '#1D1A33'); Q(X + 3, T + 7, 2, 2, '#1D1A33'); q(X - 4, T + 7, '#ffffff'); q(X + 3, T + 7, '#ffffff'); }
    else { Q(X - 4, T + 8, 2, 1, '#1D1A33'); Q(X + 3, T + 8, 2, 1, '#1D1A33'); }
    Q(X - 6, T + 10, 2, 1, L.pink); Q(X + 5, T + 10, 2, 1, L.pink);
    Q(X - 2, T + 9, 5, 3, L.wl); Q(X - 1, T + 9, 3, 1, L.ol);
    if (talk) Q(X - 1, T + 11, 3, 1, '#c45a6a'); else q(X, T + 11, L.ol);
  } else if (dir === 'left' || dir === 'right') {
    const s = dir === 'left' ? -1 : 1, cx = X - s * 2;
    Q(cx - 2, T + 5, 5, 6, L.cup); Q(cx - 1, T + 6, 3, 4, glow); q(cx, T + 7, L.cup);   // наушник сбоку
    const ex = X + s * 4;
    if (eyeOpen) Q(ex, T + 7, 2, 2, '#1D1A33'); else Q(ex, T + 8, 2, 1, '#1D1A33');
    const mx = s < 0 ? X - 10 : X + 8;                 // мордочка чуть выступает вперёд
    Q(mx, T + 8, 3, 4, L.ol); Q(mx + (s < 0 ? 1 : 0), T + 9, 2, 2, L.wl); q(mx + 1, T + 8, L.wl);
    Q(X + s * 5, T + 10, 2, 1, L.pink);
  } else {
    Q(X - 5, T + 6, 11, 5, L.wd); for (let i = 0; i < 4; i++) Q(X - 4 + i * 3, T + 6 + (i % 2) * 2, 2, 2, L.w);
  }
}

/** выходной: цветы на гавайской рубашке */
const SHIRT: [number, number, string][] = [[-4, 15, '#ff5aa0'], [3, 18, '#ffcf5c'], [-3, 19, '#7fe0b4'], [4, 15, '#f7f5ff'], [0, 19, '#ff5aa0']];

export function drawBot(a: Agent, t: number) {
  if (a.arriving) return;
  const k = KIND[a.kind], X = Math.round(a.x * S), Y = Math.round(a.y * S), sit = sitting(a), dir = a.dir;
  const T = Y - 22 + (sit ? 4 : 0);
  const head = k.head, hl = shade(head, 1.18), hd = shade(head, 0.78), ol = shade(head, 0.36);
  const body = k.body, bl = shade(body, 1.3), bd = shade(body, 0.72), obd = shade(body, 0.4);
  const walking = a.path.length > 0, act = activity(a, t), working = act === 'work', waiting = act === 'wait';
  const tea = (a.teaCup ?? 0) > t;
  if (!sit) Q(X - 7, Y - 1, 15, 2, 'rgba(0,0,0,0.28)');
  const blink = act === 'sleep' || (a.ph % 3.7) < 0.12, eye = waiting ? '#ffcf5c' : k.eye;
  const talk = !!a.say && a.say.until > t && (t * 6 | 0) % 2 === 1;
  if (a.kind === 'ollama') llamaHead(X, T, dir, !blink, talk, t);
  else {
    // антенна
    Q(X, T + 1, 1, 2, ol); Q(X - 1, T - 1, 3, 2, working && (t * 4 | 0) % 2 ? '#ffffff' : k.acc);
    // голова со скруглёнными углами, светлый верх и тёмный низ
    Q(X - 7, T + 3, 15, 1, ol); Q(X - 7, T + 13, 15, 1, ol); Q(X - 8, T + 4, 1, 9, ol); Q(X + 8, T + 4, 1, 9, ol);
    Q(X - 7, T + 4, 15, 9, head); Q(X - 7, T + 4, 15, 1, hl); Q(X - 7, T + 5, 1, 6, hl); Q(X - 7, T + 12, 15, 1, hd); Q(X + 7, T + 5, 1, 7, hd);
    Q(X - 9, T + 7, 1, 3, ol); Q(X + 9, T + 7, 1, 3, ol);
    const eyeQ = (x: number) => (blink ? Q(x, T + 8, 2, 1, eye) : Q(x, T + 7, 2, 2, eye));
    if (dir === 'down') { Q(X - 5, T + 6, 11, 5, '#1D1A33'); eyeQ(X - 3); eyeQ(X + 2); if (talk) Q(X - 1, T + 9, 3, 1, eye); }
    else if (dir === 'left') { Q(X - 7, T + 6, 9, 5, '#1D1A33'); eyeQ(X - 6); eyeQ(X - 2); }
    else if (dir === 'right') { Q(X - 1, T + 6, 9, 5, '#1D1A33'); eyeQ(X + 1); eyeQ(X + 5); }
    else { Q(X - 4, T + 7, 9, 4, hd); Q(X - 3, T + 8, 7, 1, shade(head, 0.62)); Q(X - 3, T + 10, 7, 1, shade(head, 0.62)); }
  }
  // тело, огонёк на груди, руки
  Q(X - 6, T + 14, 13, 7, obd); Q(X - 5, T + 14, 11, 6, body); Q(X - 5, T + 14, 11, 1, bl); Q(X + 4, T + 15, 1, 5, bd);
  if (a.kind === 'ollama') {                            // на худи белая лама, сзади пушистый хвостик
    if (dir === 'down') { Q(X - 1, T + 16, 3, 2, '#f6e7d2'); q(X - 1, T + 15, '#f6e7d2'); q(X + 1, T + 15, '#f6e7d2'); q(X, T + 16, working && (t * 3 | 0) % 2 ? '#5b8cff' : '#1D1A33'); }
    else if (dir === 'up') { Q(X - 1, T + 18, 3, 2, '#f6e7d2'); q(X, T + 18, '#fff6ea'); }
  }
  else if (dir === 'down') { Q(X - 2, T + 16, 5, 3, '#1D1A33'); Q(X - 1, T + 17, 3, 1, working && (t * 3 | 0) % 2 ? '#ffffff' : k.acc); }
  else if (dir !== 'up') Q(X - 1, T + 16, 3, 2, bd);
  if (env.dayOff && a.kind !== 'ollama') for (const [dx, dy, c] of SHIRT) q(X + dx, T + dy, c);
  const tap = working ? ((t * 9 + a.ph) | 0) % 2 : 0, swing = walking ? ((a.ph * 8) | 0) % 2 : 0;
  const armL = waiting ? 0 : -tap + swing, armR = waiting ? -7 - ((t * 3 | 0) % 2) : working ? -(1 - tap) : walking ? 1 - swing : 0;
  Q(X - 8, T + 15 + armL, 2, 5, bd); Q(X - 8, T + 19 + armL, 2, 1, obd);
  Q(X + 7, T + 15 + armR, 2, 5, bd); Q(X + 7, T + 19 + armR, 2, 1, obd);
  // кружка или телефон в руке
  if (act === 'coffee' || act === 'tea' || act === 'cafe' || a.carry || tea) {
    const left = dir === 'left', cx = left ? X - 13 : X + 10, sip = (t * 0.5 + a.ph) % 3, cy = T + 14 + (sip < 0.5 ? -4 : 0);
    if (act === 'cafe' && sip > 1.6 && sip < 2.6) {       // кусочек шоколадки
      const by2 = T + 12 + (sip < 2.1 ? 0 : 2);
      Q(cx, by2, 5, 4, '#3b2116'); Q(cx, by2, 5, 1, '#6b3d26'); Q(cx + (left ? 3 : 0), by2 + 2, 2, 2, '#d8d8e4');
    } else {
      const isTea = act === 'tea' || a.carry || tea;
      Q(cx, cy, 4, 4, isTea ? '#ffcf5c' : '#f7f5ff'); Q(cx, cy, 4, 1, isTea ? '#c97a2c' : '#6b4a33'); q(left ? cx - 1 : cx + 4, cy + 1, '#d8d0f0');
      if (isTea && a.lemon && (a.carry || tea)) { Q(cx + (left ? 2 : 0), cy - 1, 2, 2, '#e6f04a'); q(cx + (left ? 3 : 0), cy - 1, '#9cc23a'); }
      const st = (t * 3 | 0) % 2; q(cx + 1 + st, cy - 2, 'rgba(255,255,255,0.7)'); q(cx + 2 - st, cy - 4, 'rgba(255,255,255,0.45)');
    }
  }
  if (a.pizzaBox) { const bx = X - 8, by = T + 11; Q(bx, by, 16, 5, '#8a6a3a'); Q(bx + 1, by, 14, 4, '#e8d2a0'); Q(bx + 6, by + 1, 4, 2, '#d9442e'); }   // коробка с пиццей
  if (act === 'phone' || act === 'cab') { Q(X + 8, T + 13, 4, 6, '#1D1A33'); Q(X + 9, T + 14, 2, 3, (t * 2 | 0) % 2 ? '#5cc8ff' : '#7fe0b4'); }
  if (!sit) {
    const f = walking ? ((a.ph * 8) | 0) % 2 : 2;
    const leg = a.kind === 'ollama' ? '#e8d3b8' : '#2a2540';
    Q(X - 4, T + 20 + (f === 0 ? 0 : 1), 3, 2, leg); Q(X + 2, T + 20 + (f === 1 ? 0 : 1), 3, 2, leg);
  }
}
