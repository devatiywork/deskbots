// Болтовня: время от времени агент говорит что-то к своему занятию, погоде, лимиту, празднику.
// За столиком в кофейне — настоящие разговоры по очереди: вопрос и ответ (с пиццей на столе — про пиццу).
import { pick } from '@/shared/lib/random';
import L from '@/shared/i18n/ru/lines.json';
import D from '@/shared/i18n/ru/dialogs.json';
import { env } from '@/entities/environment';
import { pcHot, presence, speech } from '@/entities/world';
import { activity, arrived, doing, holidayLines, inChat, limitFor, say, type Agent } from '@/entities/agent';
import { actLines, sceneQuiet } from './state';

function cafeChat(a: Agent, t: number) {
  const ab = a.brk, p = ab?.cafe, pb = p?.brk;
  if (!ab || !p || !pb || pb.cafe !== a || !arrived(p) || p.place !== pb.spot || a.place !== ab.spot) return;   // ждём, пока оба сядут
  if ((a.say && a.say.until > t) || (p.say && p.say.until > t)) return;                                        // одно облачко за раз
  let c = ab.chat || pb.chat;
  if (!c || (c.i >= c.lines.length && t > c.next + 4)) {
    if (c && ab.until && t > ab.until - 12) return;                                                           // на новый разговор уже не хватит времени
    const used = c?.used || [];
    const talks = presence.pizzaOnTable ? D.pizza : D.cafe, left = talks.filter(l => !used.includes(l));
    c = ab.chat = pb.chat = { lines: pick(left.length ? left : talks), i: 0, next: t + 0.3, who: Math.random() < 0.5 ? [a, p] : [p, a], used };
    c.used.push(c.lines);
  }
  if (c.i >= c.lines.length || t < c.next) return;
  const sp = c.who[c.i % 2];
  speech.cafeLine = true; say(sp, c.lines[c.i++], t, true); speech.cafeLine = false;
  c.next = t + 5.2;
}

const TOOLS = L.tools as Record<string, string[]>;

export function chatTick(a: Agent, t: number) {
  if (a.say && a.say.until < t) a.say = null;
  if (a.brk?.cafe && arrived(a) && !a.leaving) { cafeChat(a, t); return; }
  if (a.say || t < a.nextSay || a.leaving || !arrived(a) || sceneQuiet()) return;
  const act = activity(a, t);
  if (act === 'brief' || act === 'serve') return;      // на брифинге говорят по очереди, с чаем в руках не до болтовни
  if (act === 'work' && (a.detail || inChat(a) || a.kind === 'ollama') && Math.random() < 0.6) { say(a, doing(a, true), t, false); return; }
  let pool = act === 'work' ? (TOOLS[a.tool] && Math.random() < 0.6 ? TOOLS[a.tool] : L.work) : actLines(act);
  if (act === 'work' && a.kind === 'ollama') pool = L.ollamaWork;
  if ((act === 'desk' || act === 'tv' || act === 'coffee' || act === 'tea' || act === 'bench') && Math.random() < 0.25) {
    pool = presence.typhoon ? L.typhoon : env.season === 'winter' ? [...L.sky[env.weather], L.cold] : L.sky[env.weather];
  }
  const lim = limitFor(a), r2 = Math.random();
  if (lim === 'limited' && r2 < 0.5) pool = L.limited;
  else if (lim === 'near' && r2 < 0.3) pool = L.limitNear;
  else if (act !== 'work' && env.holiday && r2 < 0.2) pool = holidayLines();
  else if (act !== 'work' && env.dayOff && r2 < 0.2) pool = L.dayoff;
  else if (pcHot() && r2 < 0.15) pool = L.hot;
  say(a, pick(pool), t, false);
}
