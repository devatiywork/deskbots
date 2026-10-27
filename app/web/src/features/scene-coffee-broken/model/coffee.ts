// Кофемашина сломалась: агент идёт за кофе и видит красную лампу, офис паникует, Codex чинит («sudo make coffee»),
// машина снова варит (сценка coffee). Пока сломана — место у кофемашины занято заглушкой, за кофе никто не ходит.
import { audio, burst, filt, sfx, tone } from '@/shared/audio';
import { FAST, flag } from '@/shared/lib/flags';
import { pick, rand, shuffle } from '@/shared/lib/random';
import { fill } from '@/shared/i18n';
import T from '@/shared/i18n/ru/scenes2.json';
import { BREAK_SPOTS, bus, later, presence, sceneOn, sceneRegistry, speech } from '@/entities/world';
import { agents, arrived, avail, endBreak, nick, sceneCrew, sceneSay, type Agent } from '@/entities/agent';

/** место у кофемашины */
const SPOT = BREAK_SPOTS[0];
/** заглушка-владелец места, пока машина сломана */
const BROKEN = { broken: true };

/** go — агент идёт за кофе; broken — паника; fix — мастер идёт к машине и чинит */
export type CoffeeStage = 'go' | 'broken' | 'fix';
/**
 * a — кто нашёл поломку; fixer — кто чинит; at — начало этапа; fixAt — мастер дошёл до машины;
 * step — сколько реплик этапа сказано; panic — кто паникует; lines — их реплики; start — начало сценки
 */
export interface CoffeeFail {
  a: Agent; fixer: Agent | null; state: CoffeeStage; at: number; fixAt: number; step: number;
  panic: Agent[]; lines: string[]; start: number;
}

let cf: CoffeeFail | null = null, cfNext = flag('coffee') ? 15 : FAST ? 90 : rand(7200, 14400);
/** машина сломана: дым и «!» над ней; fixedAt — когда починили (лампа зеленеет) */
let broken = false, fixedAt = 0;

/** Идущая поломка (null — нет). */
export const coffeeFail = () => cf;
/** Для рисования: сломана ли, чинят ли прямо сейчас, когда починили. */
export const coffeeFx = () => ({ broken, fixing: broken && !!cf?.fixAt, fixedAt });

// при руководстве не ломается: визит важнее
const busy = () => sceneOn() || speech.briefTalking || sceneRegistry.isActive('brief') || presence.boss;

/** Машина фыркает и затихает. */
function sputter() {
  sfx.fail();
  if (audio.ok()) burst(0.7, 0.05, [filt('lowpass', 700)], 0.1, 0.01, true);
}
/** Стук ключом по железу: n ударов вразнобой. */
function clanks(n: number) {
  if (!audio.ok()) return;
  for (let i = 0; i < n; i++) {
    const w = i * 0.42 + rand(0, 0.12);
    burst(0.07, 0.05, [filt('bandpass', rand(1800, 3200), 8)], w);
    tone(rand(1400, 2200), 0.06, 'square', 0.006, w);
  }
}

/** Кто идёт за кофе: тот, кто уже туда собрался, или свободный за столом. null — место занято кем-то ещё. */
function coffeeGoer(): Agent | null {
  const o = [...agents.values()].find(x => x === SPOT.owner);
  if (SPOT.owner) return o && avail(o) && o.brk?.spot === SPOT && o.spot !== SPOT ? o : null;
  const crew = sceneCrew().filter(x => x.spot !== SPOT && x.status !== 'waiting');
  return crew.find(x => !!x.desk && x.place === x.desk) || crew[0] || null;
}

function start(t: number) {
  if (t < cfNext) return;
  if (busy()) { cfNext = t + (FAST ? 15 : 60); return; }
  if (sceneCrew().length < 2) { cfNext = t + (FAST ? 30 : 300); return; }
  const a = coffeeGoer();
  if (!a) { cfNext = t + (FAST ? 15 : 60); return; }
  if (speech.talkWho?.includes(a)) bus.emit('talk-stop', { who: a });
  const going = a.brk?.spot === SPOT;
  if (a.brk && !going) endBreak(a, t);
  SPOT.owner = a; a.brk = { spot: SPOT, until: 0, errand: true };
  // сценка уже идёт, поэтому реплика не ждёт, пока договорит сосед
  cf = { a, fixer: null, state: 'go', at: t, fixAt: 0, step: 0, panic: [], lines: [], start: t };
  if (!going) sceneSay(a, pick(T.coffee.go), t);
}

/** Конец сценки: все поручения сняты, место у кофемашины свободно. */
function finish(t: number) {
  const c = cf;
  if (!c) return;
  for (const x of [c.a, c.fixer]) if (x?.brk?.errand && x.brk.spot === SPOT) endBreak(x, t);
  if (SPOT.owner === BROKEN || SPOT.owner === c.a || SPOT.owner === c.fixer) SPOT.owner = null;
  broken = false; cf = null; cfNext = t + (FAST ? 150 : rand(7200, 14400));
}

/** Кто чинит: Codex, если он свободен, иначе любой свободный, в крайнем случае сам нашедший. */
function pickFixer(c: CoffeeFail): Agent | null {
  const crew = sceneCrew();
  return crew.find(x => x.kind === 'codex') || crew.find(x => x !== c.a) || (avail(c.a) ? c.a : null);
}

/** Машина заработала: лампа зеленеет, звон, мелет кофе. */
function works(c: CoffeeFail, t: number) {
  broken = false; fixedAt = t;
  if (c.fixer) { sceneSay(c.fixer, T.coffee.works, t); c.fixer.fxChip = { name: 'check', until: t + 4 }; }
  sfx.chime(); later(t + 0.8, () => sfx.grind());
}

export function coffeeStep(t: number) {
  if (!cf) { start(t); return; }
  const c = cf, a = c.a;
  if (t - c.start > 150) { finish(t); return; }               // что-то пошло не так: просто чиним молча
  // главные участники не отвлекаются на болтовню о своём
  for (const x of [a, c.fixer]) if (x) x.nextSay = Math.max(x.nextSay, t + 2);
  const s2 = t - (c.state === 'fix' && c.fixAt ? c.fixAt : c.at);
  const line = (n: number, at: number, fn: () => void) => { if (c.step < n && s2 > at) { c.step = n; fn(); } };
  if (c.state === 'go') {
    if (!avail(a)) { finish(t); return; }                       // ушёл домой, не дойдя до кофе
    if (!(arrived(a) && a.place === SPOT) && s2 < 40) return;
    broken = true; sputter(); sceneSay(a, pick(T.coffee.broken), t); a.fxChip = { name: 'bang', until: t + 4.5 };
    const others = shuffle(sceneCrew().filter(x => x !== a)).slice(0, Math.random() < 0.5 ? 2 : 3);
    c.panic = others.length < 2 ? [...others, a] : others;
    c.lines = shuffle(T.coffee.panic);
    c.state = 'broken'; c.at = t; c.step = 0;
    return;
  }
  if (c.state === 'broken') {
    const n = c.panic.length;
    line(1, 3.4, () => sceneSay(c.panic[0], c.lines[0], t));
    // нашедший отходит от машины: место занимает заглушка, никто больше за кофе не идёт
    line(2, 4.6, () => { if (a.brk?.errand && a.brk.spot === SPOT) endBreak(a, t); SPOT.owner = BROKEN; });
    line(3, 6.8, () => sceneSay(c.panic[1], c.lines[1], t));
    line(4, 10.2, () => { if (n > 2) sceneSay(c.panic[2], c.lines[2], t); });
    if (s2 < n * 3.4 + 2.4) return;
    const f = pickFixer(c);
    if (!f) { works(c, t); finish(t); return; }
    if (speech.talkWho?.includes(f)) bus.emit('talk-stop', { who: f });
    if (f.brk) endBreak(f, t);
    SPOT.owner = f; f.brk = { spot: SPOT, until: 0, errand: true };
    sceneSay(f, pick(T.coffee.fixGo), t);
    c.fixer = f; c.state = 'fix'; c.at = t; c.step = 0; c.lines = shuffle(T.coffee.cheer);
    return;
  }
  const f = c.fixer!;
  if (!avail(f)) { works(c, t); finish(t); return; }
  if (!c.fixAt) {
    // мастер дошёл (или долго идёт — начинает издалека): «sudo make coffee» и стук ключом
    if ((arrived(f) && f.place === SPOT) || t - c.at > 35) { c.fixAt = t; sceneSay(f, T.coffee.sudo, t); clanks(9); f.fxChip = { name: 'term', until: t + 8.4 }; }
    return;
  }
  line(1, 4.4, () => { sceneSay(f, pick(T.coffee.fixing), t); clanks(7); });
  line(2, 8.4, () => works(c, t));
  // радуются двое разных (если есть), реплики не повторяются
  const cheer = (i: number) => {
    const crew = sceneCrew().filter(x => x !== f), who = crew[i] || crew[0];
    if (who) sceneSay(who, fill(c.lines[i], { name: nick(f) }), t);
  };
  line(3, 10.6, () => cheer(0));
  line(4, 13, () => cheer(1));
  if (s2 > 15.5) finish(t);
}

sceneRegistry.add({ name: 'coffee', active: () => !!cf, step: (_dt, t) => coffeeStep(t) });
