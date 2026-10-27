// Перерывы: работающий агент иногда встаёт из-за стола за кофе или чаем; отдыхающий выходит на лавочку
// или зовёт кого-нибудь в кофейню — за круглый столик на кухне, пить кофе и есть шоколад.
import { sfx } from '@/shared/audio';
import { FAST } from '@/shared/lib/flags';
import { pick, rand, shuffle } from '@/shared/lib/random';
import L from '@/shared/i18n/ru/lines.json';
import { BENCH, BREAK_SPOTS, CAFE, presence, type Place } from '@/entities/world';
import { agents, arrived, endBreak, free, outGap, resting, say, settled, type Agent, type Break } from '@/entities/agent';
import { actLines, life } from './state';

// когда двое сели за столик: шоколад на столике доедают по плитке раз в 7 секунд
let since = 0;
const seenCafe = new WeakSet<Break>();
export const cafeSince = () => since;

/** Отметить новую пару за столиком: свою или посаженную другой фичей (пицца). */
export function noteCafe(a: Agent, t: number) {
  const b = a.brk;
  if (!b?.cafe || seenCafe.has(b)) return;
  seenCafe.add(b);
  if (b.cafe.brk) seenCafe.add(b.cafe.brk);
  since = t;
}

/** Кофейня: позвать за столик того, кто отдыхает или сидит без дела за столом. false — не вышло. */
export function cafeWith(a: Agent, t: number): boolean {
  if (Math.random() > (FAST ? 0.8 : 0.4)) return false;
  const ok = (seat: Place, x: Agent) => !seat.owner || seat.owner === x;
  const mates = [...agents.values()].filter(p => p !== a && settled(p, t) && (resting(p, t) || (free(p) && p.place === p.desk && p.status !== 'waiting')));
  for (const p of shuffle(mates)) {
    for (const [sa, sp] of [[CAFE[0], CAFE[1]], [CAFE[1], CAFE[0]]]) {
      if (!ok(sa, a) || !ok(sp, p)) continue;
      sa.owner = a; sp.owner = p;
      a.brk = { spot: sa, until: 0, cafe: p }; p.brk = { spot: sp, until: 0, cafe: a };
      noteCafe(a, t);
      return true;
    }
  }
  return false;
}

/** Отдыхающий выходит посидеть на лавочке справа или зовёт кого-нибудь в кофейню. */
function goOut(a: Agent, t: number) {
  a.nextOut = t + outGap();
  if (cafeWith(a, t)) return;
  if (BENCH.owner) return;
  BENCH.owner = a; a.brk = { spot: BENCH, until: 0 };
}

export function breakTick(a: Agent, t: number) {
  if (a.leaving || a.arriving) return;
  const b = a.brk;
  if (b?.brief || b?.errand) { if (a.status === 'waiting' && b.brief) endBreak(a, t); return; }
  if (b) {
    const sp = b.spot, there = arrived(a) && a.place === sp;
    if (there && !b.until) {
      // пришёл: сколько пробудет, реплика, звук кофемашины, кулера или чашки
      b.until = t + (b.cafe ? rand(26, 40) : sp === BENCH ? (FAST ? rand(12, 18) : rand(30, 60)) : rand(10, 18));
      if (b.cafe) {
        const p = b.cafe;
        if (p.brk?.until && !(p.say && p.say.until > t)) { say(a, pick(L.cafeHi), t, true); p.nextSay = Math.max(p.nextSay, t + 4.5); }
      } else say(a, pick(actLines(sp.act)), t, true);
      if (sp === BREAK_SPOTS[0]) sfx.grind(); else if (sp === BREAK_SPOTS[1]) sfx.glug();
      else if (sp.act === 'coffee' || sp.act === 'tea' || b.cafe) sfx.pour();
    }
    // разговор за столиком доводят до конца
    const midChat = !!b.chat && b.chat.i < b.chat.lines.length && b.cafe?.brk?.chat === b.chat;
    if (a.status === 'waiting' || (b.until && t > b.until && !midChat)) endBreak(a, t);
    return;
  }
  if (life.brief || presence.boss) return;             // зовут на брифинг или в офисе руководство: сами никуда не идём
  if (resting(a, t)) { if (t > a.nextOut && settled(a, t)) goOut(a, t); return; }
  if (t < a.nextBreak || !settled(a, t)) return;
  if (!(a.desk && arrived(a) && a.place === a.desk && a.status !== 'waiting')) { a.nextBreak = t + 15; return; }
  if (cafeWith(a, t)) return;
  const spots = BREAK_SPOTS.filter(s => !s.owner);
  if (!spots.length) { a.nextBreak = t + 30; return; }
  const spot = pick(spots);
  spot.owner = a;
  a.brk = { spot, until: 0 };
}
