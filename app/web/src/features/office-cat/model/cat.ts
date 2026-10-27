// Рыжий кот Мурчик: спит на коврике, гуляет, приходит к агентам. К работающему за столом садится рядом,
// к тем, кто на диване, ложится мурчать, у кофе выпрашивает. Встречает приехавших у двери и провожает уходящих.
// Иногда засыпает на робот-пылесосе: тот выезжает — кот катается по офису.
import { sfx } from '@/shared/audio';
import { FAST, has } from '@/shared/lib/flags';
import { pick, rand } from '@/shared/lib/random';
import L from '@/shared/i18n/ru/lines.json';
import C from '@/shared/i18n/ru/cat.json';
import { V, VACUUM_DOCK, bus, crowd, now, presence, type Pt, type Speaker } from '@/entities/world';
import { agents, arrived, say, type Agent } from '@/entities/agent';

/** Место кота: проход и путь от него (как у агентов, но без позы и занятия). */
export interface CatPlace { lane: number; entry: Pt[] }
export type CatMode = 'sleep' | 'visit' | 'onDesk' | 'sofa' | 'beg' | 'wander' | 'greet' | 'ride';
/** вкусняшка: летит дугой от (x0, y0) к (x1, y1) с момента t0; eat — когда кот начал есть */
export interface Toss { x0: number; y0: number; x1: number; y1: number; t0: number; eat: number }
export interface Heart { x: number; y: number; life: number }

export interface Cat extends Speaker {
  path: Pt[]; pending: CatPlace | null; place: CatPlace;
  dir: 'left' | 'right'; ph: number; mode: CatMode; until: number;
  /** к кому пришёл */
  buddy: Agent | null;
  speed: number; hearts: Heart[]; nextHeart: number;
  toss: Toss | null;
  /** провожает уходящего (а не встречает) */
  bye: boolean;
}

/** коврик в чилл-зоне, где кот спит */
const CAT_MAT: CatPlace = { lane: 142, entry: [{ x: 131, y: 142 }, { x: 131, y: 124 }] };
/** робот-пылесос на базе: кот запрыгивает на него */
const VACUUM: CatPlace = { lane: 142, entry: [{ x: VACUUM_DOCK.x, y: 142 }, VACUUM_DOCK] };

export const cat: Cat = {
  x: 131, y: 124, path: [], pending: null, place: CAT_MAT, dir: 'left', ph: 0, mode: 'sleep', until: 0, buddy: null,
  say: null, speed: 20, hearts: [], nextHeart: 0, toss: null, bye: false,
};
crowd.add(() => [cat]);

const catTime = (a: number, b: number) => (FAST ? rand(a / 4, b / 4) : rand(a, b));

/** Путь как у агентов: назад до прохода, по коридору в нужный проход, дальше к месту. */
function catRoute(place: CatPlace) {
  if (cat.path.length) { cat.pending = place; return; }
  const from = cat.place, pts = [...from.entry].reverse().slice(1);
  if (from.lane !== place.lane) pts.push({ x: V, y: from.lane }, { x: V, y: place.lane });
  pts.push(...place.entry);
  cat.path = pts; cat.place = place; cat.pending = null;
}

function catGo(place: CatPlace, mode: CatMode, buddy: Agent | null = null, speed = 20) {
  presence.catOnVacuum = false;                                // слезает с пылесоса, если сидел
  cat.toss = null; cat.mode = mode; cat.buddy = buddy; cat.speed = speed; cat.until = 0; cat.say = null;
  if (place === cat.place && !cat.path.length) return;
  catRoute(place);
}

/** Кот бежит к двери встретить приехавшего (bye — проводить уходящего). */
export function catGreet(a: Agent, bye = false) {
  if (cat.mode === 'greet' || (cat.toss && cat.toss.eat) || riding()) return;
  catGo({ lane: 142, entry: [{ x: 178, y: 142 }, { x: 178, y: 151 }] }, 'greet', a, 42);
  cat.bye = bye;
}

function catSay(text: string, t: number) { cat.say = { text, until: t + 3, at: t }; sfx.meow(); }

const isAgent = (o: object): o is Agent => 'id' in o && agents.get((o as Agent).id) === o;

// приехавшего встречает у двери
bus.on('agent-arrived', ({ agent }) => { if (isAgent(agent)) catGreet(agent); });

// уходящего провожает: агент стал «уходящим» (его закрыли) — кот бежит к двери
const leavingSeen = new Set<string>();
function watchLeaving() {
  for (const a of agents.values()) {
    if (a.leaving && !leavingSeen.has(a.id)) { leavingSeen.add(a.id); catGreet(a, true); }
    else if (!a.leaving) leavingSeen.delete(a.id);
  }
  for (const id of leavingSeen) if (!agents.has(id)) leavingSeen.delete(id);
}

/** Куда дальше: выпрашивать у пьющих кофе, спать, к работающему на стол, к дивану или просто погулять. */
function catPlan() {
  const here = [...agents.values()].filter(a => !a.arriving && !a.leaving && !a.place.out && arrived(a));
  const desk = here.filter(a => a.place === a.desk), sofa = here.filter(a => a.place.sit && !a.place.desk && a.place.lane === 82);
  const drink = here.filter(a => a.brk && a.place === a.brk.spot);
  const r = Math.random();
  if (drink.length && r < 0.6) return catGo({ lane: 142, entry: [{ x: 288, y: 142 }, { x: 288, y: 128 }] }, 'beg', pick(drink), 34);
  if (r < 0.3) return catGo(CAT_MAT, 'sleep');
  // поспать на пылесосе, пока тот на базе (#vacuum — чаще)
  if (!presence.vacuum && Math.random() < (has('vacuum') ? 0.6 : 0.15)) return catGo(VACUUM, 'ride');
  if (desk.length && r < 0.65) {
    // кто дольше всех работает без перерыва, к тому кот садится прямо на стол
    const busy = desk.filter(a => a.workSince).sort((x, y) => (x.workSince ?? 0) - (y.workSince ?? 0))[0];
    const a = busy && Math.random() < 0.7 ? busy : pick(desk), d = a.desk!;
    if (a === busy) return catGo({ lane: d.lane, entry: [{ x: d.cx + 9, y: d.lane }, { x: d.cx + 9, y: d.y0 + 9 }] }, 'onDesk', a);
    return catGo({ lane: d.lane, entry: [{ x: d.cx + 10, y: d.lane }, { x: d.cx + 10, y: d.y0 + 22 }] }, 'visit', a);
  }
  if (sofa.length && r < 0.85) {
    const a = pick(sofa), x = Math.max(97, a.x - 7);           // слева от агента: справа над ним значок
    return catGo({ lane: 82, entry: [{ x, y: 82 }, { x, y: 97 }] }, 'sofa', a);
  }
  const spots: [number, number][] = [[142, rand(100, 140)], [118, rand(160, 262)], [78, rand(160, 262)], [142, rand(170, 250)]];
  const [lane, x] = pick(spots);
  return catGo({ lane, entry: [{ x, y: lane }] }, 'wander');
}

const STAY: Record<CatMode, () => number> = {
  sleep: () => catTime(12, 35), visit: () => catTime(9, 15), onDesk: () => catTime(20, 40), sofa: () => catTime(16, 30),
  beg: () => catTime(6, 10), wander: () => catTime(2, 5), greet: () => 6, ride: () => catTime(40, 120),
};

/** Едет на пылесосе: не встречает гостей и не слезает на ходу. */
const riding = () => cat.mode === 'ride' && !cat.path.length && presence.catOnVacuum && !!presence.vacuum;

/** Сидит на пылесосе: пришёл — запрыгнул (если пылесос ещё дома), едет вместе с ним, слезает только на базе. */
function rideStep(t: number) {
  if (!cat.until) {
    if (presence.vacuum) { catPlan(); return; }                // пылесос уехал без него
    cat.until = t + STAY.ride(); presence.catOnVacuum = true; cat.say = null;
  }
  const v = presence.vacuum ?? VACUUM_DOCK;
  cat.x = v.x; cat.y = v.y;
  if (t > cat.until && !presence.vacuum) catPlan();
}

/** Пришёл на место: мяукает, агент отвечает, у кофе может получить вкусняшку. */
function arrivedAt(b: Agent | null, t: number) {
  cat.until = t + STAY[cat.mode]();
  if (b) cat.dir = b.x > cat.x ? 'right' : 'left';
  if (!b) return;
  if (cat.mode === 'greet') {
    catSay(cat.bye ? C.meow.bye : C.meow.hi, t);
    setTimeout(() => { if (agents.has(b.id)) say(b, pick(cat.bye ? C.greetBye : C.greetHi), now(), true); }, 900);
  }
  if (cat.mode === 'visit' || cat.mode === 'onDesk') { say(b, pick(L.cat.desk), t, true); setTimeout(() => catSay(pick(C.visit), now()), 1200); }
  if (cat.mode === 'sofa') { catSay(C.meow.purr, t); sfx.purr(); if (Math.random() < 0.6) setTimeout(() => say(b, pick(L.cat.sofa), now(), false), 1500); }
  if (cat.mode === 'beg') {
    catSay(C.meow.ask, t);
    if (Math.random() < (FAST ? 0.75 : 0.5)) {
      // агент кидает вкусняшку, кот её ест
      cat.until = Math.max(cat.until, t + 7);
      setTimeout(() => {
        const n = now();
        if (cat.mode !== 'beg' || cat.path.length || !agents.has(b.id)) return;
        say(b, pick(L.cat.treat), n, true);
        cat.toss = { x0: b.x, y0: b.y - 8, x1: cat.x + (cat.dir === 'right' ? 4 : -4), y1: cat.y - 0.5, t0: n + 0.4, eat: 0 };
      }, 1400);
    } else setTimeout(() => say(b, pick(L.cat.beg), now(), false), 1400);
  }
}

function stepInner(dt: number, t: number) {
  cat.ph += dt;
  if (cat.say && cat.say.until < t) cat.say = null;
  for (const h of cat.hearts) { h.y -= dt * 6; h.life -= dt; }
  cat.hearts = cat.hearts.filter(h => h.life > 0);
  if (cat.mode === 'ride' && !cat.path.length) { rideStep(t); return; }
  if (cat.path.length) {
    const p = cat.path[0], dx = p.x - cat.x, dy = p.y - cat.y, d = Math.hypot(dx, dy), v = cat.speed * dt;
    if (Math.abs(dx) > 0.3) cat.dir = dx > 0 ? 'right' : 'left';
    if (d <= v) { cat.x = p.x; cat.y = p.y; cat.path.shift(); if (!cat.path.length && cat.pending) catRoute(cat.pending); }
    else { cat.x += (dx / d) * v; cat.y += (dy / d) * v; }
    return;
  }
  const b = cat.buddy;
  if (!cat.until) arrivedAt(b, t);
  const tz = cat.toss;
  if (tz && !tz.eat && t > tz.t0 + 0.7) { tz.eat = t; catSay(C.meow.eat, t); sfx.munch(); }
  if (tz && tz.eat && t > tz.eat + 2.8) cat.toss = null;
  // сердечки, пока кот рядом с агентом или ест вкусняшку
  const near = cat.mode === 'visit' || cat.mode === 'onDesk' || cat.mode === 'sofa' || cat.mode === 'greet';
  if ((near || (tz && tz.eat)) && t > cat.nextHeart) { cat.hearts.push({ x: cat.x + rand(-2, 2), y: cat.y - 9, life: 1.6 }); cat.nextHeart = t + rand(1.2, 2.6); }
  const gone = b && cat.mode !== 'greet' && (b.leaving || !agents.has(b.id) || !arrived(b) || (cat.mode === 'beg' && !b.brk));
  if (t > cat.until || gone) catPlan();
}

/** Шаг кота за кадр (после шага агентов). */
export function catStep(dt: number, t: number) {
  watchLeaving();
  stepInner(dt, t);
  // высота облачка: лёжа и на ходу кот ниже
  cat.labelY = cat.y - (presence.catOnVacuum ? 12 : cat.path.length || cat.mode === 'sleep' || cat.mode === 'sofa' ? 7 : 9);
}

/** Клик по коту: кот получает вкусняшку прямо с неба (если не занят едой и не идёт). */
export function feedCat() {
  const t = now();
  if (cat.toss || cat.path.length || presence.catOnVacuum) { catSay(C.meow.ask, t); return; }
  cat.mode = 'wander'; cat.buddy = null; cat.until = t + 6;
  catSay(C.meow.hi, t);
  cat.toss = { x0: cat.x + (cat.dir === 'right' ? 12 : -12), y0: cat.y - 18, x1: cat.x + (cat.dir === 'right' ? 4 : -4), y1: cat.y - 0.5, t0: t + 0.3, eat: 0 };
}

/** Глубина кота при сортировке кадра: на столе — по столу, на диване — чуть выше спинки. */
export const catDepthY = () =>
  cat.mode === 'onDesk' && !cat.path.length && cat.buddy?.desk ? cat.buddy.desk.y0 + 14 : cat.y + (cat.mode === 'sofa' && !cat.path.length ? -2 : 0.3);

/** Попал ли клик (в клетках сцены) по коту. */
export const catHit = (sx: number, sy: number) => Math.abs(sx - cat.x) < 8 && sy > cat.y - (presence.catOnVacuum ? 12 : 9) && sy < cat.y + 2;
