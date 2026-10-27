// Пицца: кнопка «Заказать пиццу» (событие order-pizza), обед или просто так раз в час-два.
// Агент звонит в пиццерию, фургон привозит курьера к двери, агент несёт коробку на кухонный стол, рядом садится свободный.
import { sfx } from '@/shared/audio';
import { FAST, has } from '@/shared/lib/flags';
import { pick, rand } from '@/shared/lib/random';
import T from '@/shared/i18n/ru/scenes.json';
import { CAFE, PIZZA_DOOR, bus, later, now, presence, sceneOn, sceneRegistry, speech } from '@/entities/world';
import { agents, arrived, endBreak, sceneCrew, sceneSay, type Agent } from '@/entities/agent';
import { moveAlong, npc, npcSay, npcs, type Person } from '@/entities/person';
import { cars, laneFree, type Car } from '@/entities/car';
import { PIZZA_TIME, VAN_LEN, VAN_STOP, local } from '../lib/pizza';
import { drawVan } from '../ui/van';

/** заказ → фургон едет → стоит, курьер идёт к двери → отдаёт коробку → уходит → фургон уезжает */
export type PizzaStage = 'order' | 'come' | 'stop' | 'talk' | 'leave' | 'go';
/** a — кто заказал и встречает курьера; cur — курьер; d1…d3 — реплики у двери уже сказаны */
export interface Pizza { a: Agent; state: PizzaStage; at: number; van: Car | null; cur: Person | null; d1?: boolean; d2?: boolean; d3?: boolean }

let pizza: Pizza | null = null;
/** когда попросили пиццу (0 — не просили): заказ ждёт, пока не идёт другая сценка */
let pizzaWant = 0;
/** пицца лежит на кухонном столе до этого времени */
let tableUntil = 0;
let pizzaNext = has('pizza') ? 15 : FAST ? 70 : rand(3600, 7200);

// брифинг старого движка (brief) недоступен: вместо него — его реплики по очереди или сценка 'brief', если зарегистрирована
const busy = () => sceneOn() || speech.briefTalking || sceneRegistry.isActive('brief');

/** Кто закажет: свободный агент, лучше не занятый работой; не тот, кто ждёт ответа. */
function pizzaTarget(): Agent | null {
  const list = sceneCrew().filter(a => a.status !== 'waiting');
  return list.find(a => a.status !== 'working') || list[0] || null;
}

/** Попросить пиццу (кнопка в панели, обед): закажут, как только можно. */
export function orderPizza() { if (!pizza && !pizzaWant && pizzaTarget()) pizzaWant = now(); }

/** Для кнопки в панели: пицца заказана или едет. */
export const pizzaStatus = (): 'idle' | 'coming' => (pizza || pizzaWant ? 'coming' : 'idle');
/** До какого времени пицца лежит на столе (секунды сцены). */
export const pizzaUntil = () => tableUntil;

function pizzaWantTick(t: number) {
  if (!pizza && !pizzaWant && t > pizzaNext) { pizzaNext = t + (FAST ? 120 : rand(3600, 7200)); if (!sceneOn()) orderPizza(); }
  if (!pizzaWant || pizza) return;
  if (busy() || tableUntil > t) { if (t - pizzaWant > 120) pizzaWant = 0; return; }
  const a = pizzaTarget();
  if (!a) { pizzaWant = 0; return; }
  // пусть договорит (но не дольше 20 секунд)
  const talking = !!speech.talkWho?.includes(a);
  if (((a.say && a.say.until > t) || talking) && t - pizzaWant < 20) return;
  pizzaWant = 0;
  if (talking) bus.emit('talk-stop', { who: a });
  pizza = { a, state: 'order', at: t, van: null, cur: null };
  sceneSay(a, pick(T.pizza.order), t);
  // звонит в пиццерию: два гудка, потом разговор
  later(t + 2.2, () => sfx.dial(2));
  later(t + 6.2, () => sceneSay(a, pick(T.pizza.call), now()));
  const rest = sceneCrew().filter(x => x !== a);
  if (rest.length) { const b = pick(rest); later(t + 9.4, () => sceneSay(b, pick(T.pizza.wish), now())); }
}

function pizzaStep(dt: number, t: number) {
  const pz = pizza;
  if (!pz) return;
  const a = pz.a, here = agents.has(a.id) && !a.leaving, van = pz.van, s2 = t - pz.at;
  // агент донёс коробку до кухонного стола: пицца на столе, рядом садится тот, кто свободен
  if (a.pizzaBox && here && a.brk?.pizza && arrived(a) && a.place === a.brk.spot) {
    a.pizzaBox = false; tableUntil = t + PIZZA_TIME; sfx.pour();
    sceneSay(a, pick(T.pizza.onTable), t);
    const seat = a.brk.spot, other = CAFE.find(s => s !== seat)!, p = sceneCrew().find(x => x !== a && x.status !== 'waiting');
    // cafeSince (шоколадка за столиком) не трогаем: пока на столе пицца, шоколад не рисуется, а потом от него остаётся кусок в любом случае
    if (p && (!other.owner || other.owner === p)) {
      if (p.brk) endBreak(p, t);
      other.owner = p; p.brk = { spot: other, until: 0, cafe: a }; a.brk = { spot: seat, until: 0, cafe: p };
    } else a.brk = { spot: seat, until: 0 };
  }
  if (!here) a.pizzaBox = false;
  if (pz.state === 'order') {
    if (s2 > 13 && laneFree(-90, VAN_STOP + 30)) {
      pz.van = { van: true, x: -40, y: 192, ang: 0, v: 80, dir: 1, len: VAN_LEN, col: '#d9442e', state: 'come', draw: drawVan };
      cars.push(pz.van); pz.state = 'come'; pz.at = t;
    }
    return;
  }
  if (!van) return;
  if (pz.state === 'come') {
    const d = VAN_STOP - van.x;
    van.v = Math.max(6, Math.min(80, d * 1.6)); van.x += van.v * dt;
    if (d <= 0.3) {
      van.x = VAN_STOP; van.v = 0; van.state = 'stop'; pz.state = 'stop'; pz.at = t; sfx.horn('pizza');
      if (here) { if (a.brk) endBreak(a, t); PIZZA_DOOR.owner = a; a.brk = { spot: PIZZA_DOOR, until: 0, errand: true }; }
    }
    return;
  }
  if (pz.state === 'stop') {
    // открывается боковая дверь, курьер с коробкой идёт к двери офиса
    if (s2 > 0.6 && !van.side) {
      van.side = true; sfx.door();
      const d = local(van, 1, -7);
      pz.cur = npc('courier', d.x, d.y, [{ x: d.x, y: 174.5 }, { x: 192, y: 174.5 }, { x: 192, y: 166 }]); pz.cur.box = true;
    }
    if (pz.cur && moveAlong(pz.cur, dt, 30)) {
      pz.cur.dir = 'up';
      const met = here && arrived(a) && a.place === PIZZA_DOOR;
      if (met || !here || s2 > 40) { pz.state = 'talk'; pz.at = t; npcSay(pz.cur, pick(T.pizza.courierHi), t); if (met) a.dir = 'down'; }
    }
    return;
  }
  const cur = pz.cur;
  if (!cur) return;
  if (pz.state === 'talk') {
    if (s2 > 2.2 && !pz.d1) { pz.d1 = true; if (here) sceneSay(a, pick(T.pizza.thanks), t); }
    if (s2 > 3.6 && !pz.d2) { pz.d2 = true; if (here && a.place === PIZZA_DOOR) { cur.box = false; a.pizzaBox = true; } }
    if (s2 > 4.8 && !pz.d3) { pz.d3 = true; npcSay(cur, pick(T.pizza.courierBye), t); }
    if (s2 > 6.5) {
      const d = local(van, 1, -7);
      cur.path = [{ x: 192, y: 174.5 }, { x: d.x, y: 174.5 }, d]; pz.state = 'leave'; pz.at = t;
      PIZZA_DOOR.owner = null;
      // с коробкой — на кухню, к свободному табурету (кто там сидел, уходит)
      if (here && a.pizzaBox) {
        const seat = CAFE.find(s => !s.owner) || CAFE[0];
        if (seat.owner && seat.owner !== a) endBreak(seat.owner as Agent, t);
        seat.owner = a; a.brk = { spot: seat, until: 0, errand: true, pizza: true };
      } else if (here) endBreak(a, t);
    }
    return;
  }
  if (pz.state === 'leave') {
    if (!cur.hidden && moveAlong(cur, dt, 34)) { cur.hidden = true; npcs.splice(npcs.indexOf(cur), 1); van.side = false; sfx.door(); pz.at = t; }
    if (cur.hidden && t - pz.at > 0.8) { pz.state = 'go'; van.state = 'go'; van.v = 10; sfx.rev(); }
    return;
  }
  van.v = Math.min(110, van.v + 70 * dt); van.x += van.v * dt;   // 'go': уезжает вправо, carStep уберёт его за краем
  if (!cars.includes(van) && !a.pizzaBox) pizza = null;
}

bus.on('order-pizza', () => orderPizza());

sceneRegistry.add({
  name: 'pizza',
  active: () => !!pizza,
  step: (dt, t) => { pizzaWantTick(t); pizzaStep(dt, t); presence.pizzaOnTable = tableUntil > t; },
});
