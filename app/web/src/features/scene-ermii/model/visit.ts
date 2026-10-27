// Режим Grand Ermii: руководство приезжает на лимузине, минут десять ходит по офису и всё контролирует.
// Трое: Андрей (это ты) и Сергей — разработчики, Фёдор — владелец и начальник. Режим, имена и как часто — в настройках.
// На события других фич начальник отвечает через шину: красные тесты, push, новый кубок, новая вывеска.
import { sfx } from '@/shared/audio';
import { fill } from '@/shared/i18n';
import E from '@/shared/i18n/ru/ermii.json';
import { FAST } from '@/shared/lib/flags';
import { pick, rand, shuffle } from '@/shared/lib/random';
import { env, localNow } from '@/entities/environment';
import { bus, config, later, now, presence, sceneOn, sceneRegistry, speech } from '@/entities/world';
import { agents, endBreak, sceneCrew, sceneSay } from '@/entities/agent';
import { moveAlong, npc, npcSay, npcs } from '@/entities/person';
import { STOP_X, laneFree, rides } from '@/entities/car';
import { callLimo, limoDoor, limoNow, limoStep } from './limo';
import { bossHere, ermii, nameOf, visitLen, visitPeople, visitSay } from './state';
import { atStop, nextStop, walkTo } from './tour';

/** Следующий приезд: config.visits раз за рабочий день, в случайное время. */
export function visitPlan(t: number) {
  ermii.next = t + (FAST ? rand(90, 150) : ((Math.max(1, config.endH - 9) * 3600) / Math.max(1, config.visits)) * rand(0.6, 1.4));
}
visitPlan(now());
let plannedVisits = config.visits;

/** «Позвать сейчас» (кнопка в настройках, событие visit от приложения). */
export function callVisit() { if (config.ermii) ermii.want = true; }

// брифинг (другая фича): пока он идёт, руководство не приезжает
const briefOn = () => sceneRegistry.isActive('brief') || speech.briefTalking;

function visitStart(t: number) {
  ermii.visit = { state: 'come', at: t, people: [], crew: visitPeople(), called: false, spoke: false, tourAt: 0, doorAt: 0, quick: false, bye: false };
  ermii.want = false;
  callLimo(t);
}

/** приветствие, когда вошёл в офис */
const hi = (look: string) =>
  look === 'boss' ? (env.phase === 'night' ? E.hi.bossNight : pick(E.hi.boss)) : pick(look === 'me' ? E.hi.me : E.hi.dev);

function visitStep(dt: number, t: number) {
  limoStep(dt, t);
  const v = ermii.visit;
  if (!v) {
    if (!config.ermii || !visitPeople().length) { ermii.want = false; return; }
    const k = localNow(), work = !env.dayOff && k.h >= 9 && k.h < config.endH;
    if (!ermii.want && t > ermii.next && (!work || !sceneCrew().length)) { ermii.next = t + (FAST ? 30 : 900); return; }
    if ((ermii.want || t > ermii.next) && !sceneOn() && !briefOn() && !limoNow() && !Object.keys(rides).length && laneFree(-90, STOP_X + 50)) visitStart(t);
    return;
  }
  const c = limoNow(), s2 = t - v.at;
  if (!config.ermii && (v.state === 'out' || v.state === 'tour')) { v.state = 'gather'; v.at = t; v.quick = true; }
  if (v.state === 'come') {
    if (!config.ermii) { if (c) c.state = 'go'; ermii.visit = null; return; }
    if (c?.state !== 'stop') return;
    v.state = 'out'; v.at = t;
    // агенты замечают лимузин и бросают кофе и диван
    for (const a of agents.values()) if (a.brk && !a.brk.errand && !a.brk.brief) endBreak(a, t);
    const crew = shuffle(sceneCrew()), boss = nameOf('boss');
    if (crew[0]) later(t + 0.8, () => sceneSay(crew[0], pick([...E.arrive.seen, boss ? fill(E.arrive.seenName, { boss }) : E.arrive.seenLimo]), now()));
    if (crew[1]) later(t + 3, () => sceneSay(crew[1], pick(E.arrive.places), now()));
    return;
  }
  if (v.state === 'out') {
    // выходят по одному, хлопая дверью лимузина
    const n = v.people.length;
    if (n < v.crew.length && s2 > 0.8 + n * 0.9) {
      const p = v.crew[n], o = npc(p.look, 192, 181, [{ x: 192, y: 166 }, { x: 192, y: 152 }, { x: 192, y: 142 }]);
      o.tag = p.name.trim(); o.lane = 142; o.laptop = p.look === 'dev'; o.inside = false;
      v.people.push(o); if (c) limoDoor(c, true); v.doorAt = t;
    }
    if (c?.door && t - v.doorAt > 0.45) limoDoor(c, false);
    if (n === v.crew.length && s2 > 1.6 + n * 0.9) { if (c?.state === 'stop') { limoDoor(c, false); c.state = 'go'; sfx.rev(); } v.state = 'tour'; v.tourAt = t; }
  }
  for (const o of v.people) {
    if (o.gone) continue;
    if (!o.belled && o.y < 158) { o.belled = true; sfx.bell(); }
    if (o.path.length) {
      if (moveAlong(o, dt, 24) && !o.inside && o.y <= 142.5) {
        o.inside = true; o.dir = 'up';
        if (v.state === 'gather') continue;
        npcSay(o, hi(o.look), t); o.until = t + 2.5;
      }
      if (o.look === 'boss' && o.path.length && t > (o.stepAt || 0)) { sfx.step(); o.stepAt = t + 0.3; }   // шаги начальника слышно
      continue;
    }
    if (v.state === 'gather') continue;
    if (!o.inside) continue;
    if (o.stop && !o.at) { atStop(o, o.stop, t); continue; }
    if (t > (o.until || 0)) nextStop(o, v, t);
  }
  if (v.state === 'tour' && t - v.tourAt > visitLen()) { v.state = 'gather'; v.at = t; }
  if (v.state === 'gather') {
    if (!v.bye) {
      v.bye = true;
      // освобождают кофемашину и аркаду; без остановки отложенные реплики встреч, выступления, холодильника молчат
      for (const o of v.people) { if (o.held) { o.held.owner = null; o.held = null; } o.cup = false; o.phone = false; o.stop = null; }
      const premium = !v.quick && Math.random() < 0.15;
      visitSay('boss', v.quick ? E.bye.quick : premium ? E.bye.premium : pick(E.bye.normal), t);
      if (premium) {
        later(t + 2.4, () => { const a = pick(sceneCrew()); if (a) sceneSay(a, E.bye.hooray, now()); sfx.fanfare(); });
        bus.emit('confetti', { x: 192, y: 120, n: 50 });
      }
    }
    // к выходу и на бордюр, каждый на своё место; кто ещё идёт, сначала доходит, чтобы не срезать через столы
    v.people.forEach((o, i) => {
      if (o.out || o.path.length) return;
      o.out = true; o.stop = null; o.belled = false;
      walkTo(o, { kind: 'exit', x: 192, y: 142, lane: 142 }); o.path.push({ x: 192, y: 152 }, { x: 192, y: 166 }, { x: 186 + i * 6, y: 178 });
    });
    for (const o of v.people) if (!o.belled && o.y > 158) { o.belled = true; sfx.bell(); }
    if (!limoNow() && s2 > 3 && laneFree(-90, STOP_X + 50) && !Object.keys(rides).length) callLimo(t);
    if (limoNow()?.state === 'stop' && v.people.every(o => o.out && !o.path.length)) { v.state = 'board'; v.at = t; }
    return;
  }
  if (v.state === 'board') {
    // садятся по одному; последний закрывает дверь, лимузин уезжает
    const n = v.people.filter(o => o.gone).length;
    if (n < v.people.length && s2 > 0.5 + n * 0.8) {
      const o = v.people[n], i = npcs.indexOf(o);
      o.gone = o.hidden = true; if (i >= 0) npcs.splice(i, 1);
      if (c) limoDoor(c, true); v.doorAt = t;
    }
    if (c?.door && t - v.doorAt > 0.45 && n < v.people.length) limoDoor(c, false);
    if (n === v.people.length && s2 > 1.2 + n * 0.8) {
      if (c) { limoDoor(c, false); c.state = 'go'; } sfx.rev();
      const crew = shuffle(sceneCrew());
      if (crew[0]) later(t + 1.5, () => sceneSay(crew[0], pick(E.gone.first), now()));
      if (crew[1]) later(t + 4.2, () => sceneSay(crew[1], pick(E.gone.second), now()));
      ermii.visit = null; visitPlan(t);
    }
  }
}

sceneRegistry.add({
  name: 'visit',
  active: () => !!ermii.visit,
  // presence.boss — для агентов: при руководстве никто не отдыхает
  step: (dt, t) => { visitStep(dt, t); presence.boss = bossHere(); },
});

// начальник отвечает на события других фич, если он сейчас в офисе
bus.on('hook-fx', ({ type }) => {
  const t = now();
  if (type === 'test-fail') later(t + 2.5, () => visitSay('boss', pick(E.react.testFail)));
  else if (type === 'push-ok') later(t + 4.5, () => visitSay('boss', pick(E.react.push)));
});
bus.on('trophy', () => { later(now() + 3, () => visitSay('boss', E.react.trophy)); });
let signSaidAt = -1e9;
bus.on('sign', () => {
  const t = now();
  if (t - signSaidAt < 15) return;                   // правят вторую строку сразу после первой: одна реплика на двоих
  signSaidAt = t;
  later(t + 3, () => visitSay('boss', pick(E.react.sign)));
});
// поменяли, сколько раз в день приезжать, — новый план; режим выключили — уезжают сами (проверка в каждом шаге)
bus.on('config', () => {
  if (config.visits === plannedVisits) return;
  plannedVisits = config.visits; visitPlan(now());
});
