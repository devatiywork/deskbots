// Обход офиса: руководство встаёт за плечо к агентам, идёт к табло, к кофемашине, к холодильнику, к аркаде,
// начальник ещё в чилл-зону, раз за визит говорит по телефону и раз выступает перед всеми.
// Двое из руководства сходятся и болтают. Пришёл на место — говорит, агент отвечает.
import { sfx } from '@/shared/audio';
import { fill } from '@/shared/i18n';
import E from '@/shared/i18n/ru/ermii.json';
import { FAST } from '@/shared/lib/flags';
import { fmtBig, plural } from '@/shared/lib/format';
import { pick, rand, shuffle } from '@/shared/lib/random';
import { BREAK_SPOTS, CHILL, V, later, now, server, type Pt } from '@/entities/world';
import { agents, arrived, avail, nick, sceneCrew, sceneSay } from '@/entities/agent';
import { npcSay, type Person, type PersonStop } from '@/entities/person';
import { ermii, meName, named, nameOf, touring, visitLen, visitSay, who, type Visit } from './state';

/** остановка с координатами; w — вес при случайном выборе */
type Target = PersonStop & { x: number; y: number; lane: number };
/** near — где встать тому, кто подойдёт поговорить: сдвиг от точки (dx 0 — с той стороны, откуда идёт) */
type Spot = Target & { w: number; near?: [number, number] };
/** встреча: подходит к mate и встаёт рядом */
type Meet = Spot & { mate: Person };
type Opt = Spot | (PersonStop & { w: number });
/** у звонка нет точки: говорят там, где стоят */
const isSpot = (s: Opt): s is Spot => s.x !== undefined;
const isMeet = (s: PersonStop): s is Meet => s.kind === 'meet' && 'mate' in s;
const hasNear = (s: PersonStop): s is Spot & { near: [number, number] } => 'near' in s && !!s.near;

// рядом встают наискосок, ниже на 7–8 клеток: неоновые таблички с именами не налезают друг на друга
const NEAR_DESK_TOP: [number, number] = [8, 7];   // первый ряд: в просвет между мониторами второго ряда (выше — таблички агентов)
const NEAR_BELOW: [number, number] = [0, 8];

/** аркадный автомат в чилл-зоне */
const ARCADE = CHILL[4];

/** «2 коммита», «5 файлов»: формы слова из JSON */
const forms = (n: number, f: string[]) => plural(n, f[0], f[1], f[2]);

/** Путь по офису: в свой проход, по коридору у чилл-зоны в нужный проход, к точке. */
export function walkTo(o: Person, s: Target) {
  const pts: Pt[] = [], lane = o.lane ?? s.lane;
  if (Math.abs(o.y - lane) > 0.5) pts.push({ x: o.x, y: lane });
  if (lane !== s.lane) pts.push({ x: V, y: lane }, { x: V, y: s.lane });
  pts.push({ x: s.x, y: s.lane });
  if (s.y !== s.lane) pts.push({ x: s.x, y: s.y });
  o.path = pts; o.lane = s.lane; o.stop = s; o.at = 0;
}

/** К нему идут на встречу или уже с ним говорят. */
const isMate = (p: Person) => !!ermii.visit?.people.some(x => !!x.stop && isMeet(x.stop) && x.stop.mate === p);
/** Занят разговором: встреча, выступление, телефон — посторонние реплики не вклиниваются. */
const talking = (p: Person) => p.phone || ['meet', 'speech', 'call'].includes(p.stop?.kind ?? '') || isMate(p);
/** Может сказать реплику со стороны: в офисе и ни с кем не говорит. */
const freeTo = (look: string) => { const p = who(look); return !!p && !!p.inside && !talking(p); };
/** То же, но стоит на месте: своя реплика по приходу на остановку не перебьёт эту. */
const idleTo = (look: string) => freeTo(look) && !who(look)?.path.length;
/** Отложенное действие остановки: только пока человек на ней и не отвлёкся на встречу (на сборах остановки сброшены). */
const onStop = (o: Person, s: PersonStop, at: number, fn: () => void) => later(at, () => { if (o.stop === s && !isMate(o)) fn(); });

/** Где человек будет стоять: конец пути или там, где стоит. */
const goal = (p: Person): Pt => p.path[p.path.length - 1] ?? p;
/** Точка свободна: никто не стоит и не идёт ближе 10 клеток по x и 8 по y. */
const clear = (ps: Person[], x: number, y: number) => ps.every(p => { const g = goal(p); return Math.abs(g.x - x) >= 10 || Math.abs(g.y - y) >= 8; });
/**
 * Встреча с p: он стоит на месте, уже осмотрелся и ни с кем не говорит. Подошедший встаёт по near его остановки
 * лицом к нему; точка должна быть свободна от остальных.
 */
function meetWith(o: Person, p: Person, others: Person[]): Meet | null {
  const s = p.stop;
  if (!p.inside || p.out || p.path.length || !p.at || !s || !hasNear(s) || talking(p)) return null;
  const [dx, dy] = s.near, x = s.x + (dx || (o.x < s.x ? -10 : 10)), y = s.y + dy;
  if (!clear(others.filter(q => q !== p), x, y)) return null;
  return { kind: 'meet', mate: p, x, y, lane: s.lane, face: x < s.x ? 'right' : 'left', w: 1.5 };
}

/** О чём говорят: разработчики — о коде, начальник с Андреем — о релизе, с Сергеем — о деньгах и серверах. */
const topic = (a: string, b: string): keyof typeof E.meet => (a !== 'boss' && b !== 'boss' ? 'tech' : a === 'me' || b === 'me' ? 'release' : 'money');

/** Куда пойти дальше: за плечо к агенту, к табло, кофемашине, холодильнику, аркаде, к своим; начальник ещё в чилл-зону, к телефону, выступить. */
export function nextStop(o: Person, v: Visit, t: number) {
  if (o.held) { o.held.owner = null; o.held = null; }
  o.cup = false;
  const others = v.people.filter(p => p !== o), taken = new Set(others.map(p => p.stop?.a).filter(Boolean)), busy = new Set(others.map(p => p.stop?.kind));
  const opts: Opt[] = [], left = visitLen() - (t - v.tourAt);   // сколько ещё ходить: долгие сценки под самый отъезд не начинают
  for (const a of agents.values()) if (avail(a) && arrived(a) && a.desk && a.place === a.desk && !taken.has(a))
    opts.push({ kind: 'agent', a, x: a.desk.cx + 8, y: a.desk.lane + 6, lane: a.desk.lane, face: 'up', w: 3, near: a.desk.y0 < 70 ? NEAR_DESK_TOP : NEAR_BELOW });   // в проходе за спиной агента, таблички не налезают
  if (!busy.has('board')) opts.push({ kind: 'board', x: 163, y: 84, lane: 78, face: 'up', w: 1, near: [-10, 8] });   // левее места за первым столом; поговорить — с коридора
  if (!BREAK_SPOTS[0].owner) opts.push({ kind: 'coffee', x: 276, y: 62, lane: 78, face: 'up', w: 1, near: [10, 8] });
  if (o.look === 'boss') opts.push({ kind: 'lounge', x: 112, y: 142, lane: 142, face: 'up', w: 1, near: NEAR_BELOW });
  if (o.look === 'boss' && !v.called && t - v.tourAt > visitLen() * 0.35) opts.push({ kind: 'call', w: 4 });
  // левее холодильника, лицом к нему: начальник и Сергей
  if (o.look !== 'me' && !busy.has('fridge') && clear(others, 292, 70)) opts.push({ kind: 'fridge', x: 292, y: 70, lane: 78, face: 'right', w: 1, near: [-10, 8] });
  if (o.look !== 'boss' && !ARCADE.owner && clear(others, 86, 142)) opts.push({ kind: 'arcade', x: 86, y: 142, lane: 142, face: 'up', w: 1, near: [10, 8] });
  // выступление: раз за визит, во второй половине, посреди прохода под вторым рядом столов; позже звонка — вес чуть больше
  if (o.look === 'boss' && !v.spoke && t - v.tourAt > visitLen() * 0.45 && left > 25 && clear(others, 220, 128)) opts.push({ kind: 'speech', x: 220, y: 128, lane: 118, face: 'down', w: 5 });
  if (left > 22) for (const p of others) { const m = meetWith(o, p, others); if (m) opts.push(m); }
  const pool = opts.filter(s => s.kind !== o.lastKind || s.kind === 'agent'), total = pool.reduce((n, s) => n + s.w, 0);
  if (!pool.length) { o.until = t + 2; return; }      // идти некуда (старый движок тут падал): постоит и выберет снова
  let r = Math.random() * total, s = pool[pool.length - 1];
  for (const x of pool) { r -= x.w; if (r <= 0) { s = x; break; } }
  o.lastKind = s.kind;
  if (!isSpot(s)) { v.called = true; o.stop = s; o.path = []; o.at = 0; return; }
  if (s.kind === 'coffee') { BREAK_SPOTS[0].owner = o; o.held = BREAK_SPOTS[0]; }
  else if (s.kind === 'arcade') { ARCADE.owner = o; o.held = ARCADE; }
  else if (s.kind === 'speech') v.spoke = true;
  else if (isMeet(s)) { s.mate.until = t + 60; s.mate.lastKind = 'meet'; }   // ждёт на месте, пока подойдут
  walkTo(o, s);
}

/** Пришёл на место: смотрит, говорит, агент отвечает. */
export function atStop(o: Person, s: PersonStop, t: number) {
  const dev = nameOf('dev'), boss = nameOf('boss'), me = meName(), meHere = !!who('me');
  o.at = t; o.until = t + (FAST ? rand(6, 10) : rand(18, 34));
  if (s.face) o.dir = s.face;
  // реплика со стороны: не на сборах к выходу и не посреди чужого разговора
  const then = (dt: number, look: string, text: string) => later(t + dt, () => touring() && freeTo(look) && visitSay(look, text, now()));
  if (s.kind === 'agent') {
    const a = s.a;
    if (!a || !avail(a)) { o.until = t + 2; return; }
    const n = nick(a), st = a.status;
    let line: string, reply: string;
    if (o.look === 'boss') {
      const B = E.agent.boss;
      if (st === 'working') { line = pick(B.working.line); reply = pick(B.working.reply); }
      else if (st === 'waiting') {
        line = B.waiting.line; reply = pick(B.waiting.reply);
        if (meHere) { then(5.4, 'boss', me ? fill(B.waiting.nudge, { me }) : B.waiting.nudgeNoName); then(8.2, 'me', pick(B.waiting.answer)); }
      } else {
        line = pick(B.idle.line); reply = pick(B.idle.reply);
        if (who('dev')) { then(5.4, 'boss', fill(B.idle.nudge, { dev })); then(8.2, 'dev', pick(B.idle.answer)); }
      }
    } else {
      const M = E.agent.team;
      if (st === 'working') { line = pick(M.working.line); reply = pick(M.working.reply); }
      else if (st === 'waiting') { line = o.look === 'me' ? pick(M.waiting.lineMe) : me && meHere ? M.waiting.lineName : M.waiting.line; reply = pick(M.waiting.reply); }
      else { line = pick(M.idle.line); reply = pick(M.idle.reply); }
    }
    npcSay(o, fill(line, { n, me }), t);
    later(t + 2.6, () => avail(a) && sceneSay(a, reply, now()));
  } else if (s.kind === 'board') {
    const d = server.dayStats, B = E.board;
    if (o.look === 'boss' && d) {
      if (Math.random() < 0.5 && d.tokens > 1e8) {
        npcSay(o, fill(B.tokens, { tokens: fmtBig(d.tokens) }), t);
        if (who('dev')) then(2.8, 'dev', fill(B.payer, { boss: boss || B.chief }));
      } else {
        const c = forms(d.commits, B.commitForms);
        npcSay(o, !d.commits ? B.noCommits : fill(d.commits >= 15 ? B.manyCommits : B.fewCommits, { commits: c }), t);
      }
    } else npcSay(o, d ? fill(pick(B.team), { files: forms(d.files, B.fileForms) }) : pick(B.empty), t);
  } else if (s.kind === 'coffee') {
    sfx.grind(); later(t + 3, () => { if (o.stop === s) o.cup = true; });
    later(t + 3.4, () => o.stop === s && visitSay(o.look, pick(E.coffee), now()));
  } else if (s.kind === 'lounge') {
    npcSay(o, pick(E.lounge), t);
  } else if (s.kind === 'call') {
    o.until = t + 11; sfx.ring();
    later(t + 2.4, () => { if (o.stop !== s) return; o.phone = true; visitSay('boss', pick(E.call), now()); });   // уже собираются к выходу — не звонит
    later(t + 9.5, () => { o.phone = false; });
  } else if (isMeet(s)) meet(o, s, t, { me, dev, boss });
  else if (s.kind === 'speech') speech(o, s, t);
  else if (s.kind === 'fridge') fridge(o, s, t);
  else if (s.kind === 'arcade') arcade(o, s, t, o.look === 'me' ? me : dev, boss);
}

/** Встреча двоих: короткий разговор по очереди, лицом друг к другу; новая реплика гасит облачко собеседника. */
function meet(o: Person, s: Meet, t: number, names: Record<string, string>) {
  const p = s.mate, d = pick(E.meet[topic(o.look, p.look)]);
  const first = d.by === p.look ? p : o, second = first === o ? p : o;
  p.dir = s.face === 'right' ? 'left' : 'right';
  let dt = 0.4;
  d.lines.forEach((line, i) => {
    const sp = i % 2 ? second : first, other = sp === first ? second : first;
    later(t + dt, () => { if (o.stop !== s) return; other.say = null; visitSay(sp.look, named(line, names), now()); });
    dt += rand(2.6, 3);
  });
  o.until = p.until = t + dt + 1;
}

/** Выступление начальника: «минутку внимания», новость, два-три агента реагируют, начальник закругляется. */
function speech(o: Person, s: PersonStop, t: number) {
  const S = E.speech, n = pick(S.news), crew = shuffle(sceneCrew()).slice(0, Math.random() < 0.5 ? 2 : 3);
  // реакции на эту новость, иногда первой — общая
  const own = shuffle(n.react), lines = Math.random() < 0.35 ? [pick(S.react), ...own] : own;
  sfx.chime(); npcSay(o, S.call, t);
  onStop(o, s, t + 2.8, () => { visitSay('boss', n.text, now()); if (n.good) sfx.fanfare(); });
  crew.forEach((a, i) => onStop(o, s, t + 5.8 + i * 2.6, () => sceneSay(a, lines[i % lines.length], now())));
  const end = t + 5.8 + crew.length * 2.6 + 0.6;
  onStop(o, s, end, () => visitSay('boss', pick(S.end), now()));
  o.until = end + 3;
}

/** У холодильника: удивляется содержимому; отвечает агент или кто-то из своих. */
function fridge(o: Person, s: PersonStop, t: number) {
  const F = E.fridge, crew = sceneCrew();
  sfx.door(); npcSay(o, pick([...F.line, ...(o.look === 'boss' ? F.boss : F.dev)]), t);
  onStop(o, s, t + 4.6, () => sfx.door());
  const pal = (['me', 'dev', 'boss'] as const).find(l => l !== o.look && idleTo(l));
  if (crew.length && Math.random() < 0.6) { const a = pick(crew); onStop(o, s, t + 2.8, () => sceneSay(a, pick(F.reply), now())); }
  else if (pal && Math.random() < 0.6) onStop(o, s, t + 2.8, () => { if (idleTo(pal)) visitSay(pal, pick(F.answer), now()); });
  o.until = Math.max(o.until ?? 0, t + 6.5);
}

/** У аркады: пара раундов и реплика; начальник, если стоит и свободен, подкалывает (игрок оправдывается), иначе может вставить слово агент. */
function arcade(o: Person, s: PersonStop, t: number, name: string, boss: string) {
  const A = E.arcade;
  let asked = false;
  for (const dt of [0.2, 2.6, 5.2]) onStop(o, s, t + dt, () => sfx.arcade());
  onStop(o, s, t + 0.9, () => visitSay(o.look, pick(A.line), now()));
  onStop(o, s, t + 3.8, () => {
    const crew = sceneCrew();
    if (touring() && idleTo('boss') && Math.random() < 0.7) asked = visitSay('boss', named(pick(A.boss), { name }), now());
    else if (crew.length && Math.random() < 0.5) sceneSay(pick(crew), pick(A.agent), now());
  });
  onStop(o, s, t + 6.6, () => { if (asked) visitSay(o.look, pick([...A.answer, ...A.toBoss.map(x => fill(x, { boss }))]), now()); });
  o.until = Math.max(o.until ?? 0, t + 9.5);
}
