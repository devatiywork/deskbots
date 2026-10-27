// День рождения: раз в несколько часов у кого-то из агентов праздник. Объявляют, на кухонном столе появляется торт
// со свечами, именинник садится к нему, все поздравляют, звучит мелодия, он задувает свечи — конфетти;
// торт стоит ещё пару минут и исчезает по кусочку (сценка birthday).
import { audio, burst, filt, sfx } from '@/shared/audio';
import { FAST, flag } from '@/shared/lib/flags';
import { S } from '@/shared/lib/pixel/canvas';
import { pick, rand, shuffle } from '@/shared/lib/random';
import { fill } from '@/shared/i18n';
import T from '@/shared/i18n/ru/scenes2.json';
import { CAFE, bus, now, presence, sceneOn, sceneRegistry, speech, type Place } from '@/entities/world';
import { arrived, avail, endBreak, nick, sceneCrew, sceneSay, type Agent } from '@/entities/agent';
import { CAKE_DEPTH_Y, CAKE_TIME, CAKE_X, CAKE_Y } from '../lib/cake';
import { TUNE_LEN, birthdayTune } from '../lib/tune';

/** b — именинник, a — кто объявил, guests — кто поздравляет; seat — табурет у торта (если был свободен); singAt, blowAt — когда запели и задули */
export interface Birthday { b: Agent; a: Agent; guests: Agent[]; at: number; step: number; seat: Place | null; singAt: number; blowAt: number }

let bd: Birthday | null = null, bdNext = flag('birthday') ? 15 : FAST ? 100 : rand(10800, 21600);
/** торт: когда появился, до какого времени стоит, когда задули свечи (0 — горят) */
let cakeAt = 0, cakeUntil = 0, blownAt = 0;

/** Идущий праздник (null — нет). */
export const birthday = () => bd;
/** Для рисования: когда торт появился, до какого времени стоит, когда задули свечи. */
export const cakeState = () => ({ at: cakeAt, until: cakeUntil, blown: blownAt });
/** Торт на кухонном столе. */
export const cakeOn = (t: number) => cakeAt > 0 && t >= cakeAt && t < cakeUntil;
/** Глубина для сортировки в кадре: сразу после стола (null — торта нет). */
export const cakeDepthY = () => (cakeOn(now()) ? CAKE_DEPTH_Y : null);

// при руководстве не празднуем: визит важнее
const busy = () => sceneOn() || speech.briefTalking || sceneRegistry.isActive('brief') || presence.boss;

/** Задули свечи: «фу-у» и конфетти над тортом. */
function blow(t: number) {
  blownAt = t; cakeUntil = t + CAKE_TIME;
  if (audio.ok()) burst(0.45, 0.04, [filt('highpass', 900)], 0, 0.03);
  bus.emit('confetti', { x: CAKE_X / S, y: CAKE_Y / S - 10, n: 50 });
  sfx.fanfare();
}

function start(t: number) {
  if (t < bdNext) return;
  // пицца на столе — торт подождёт
  if (busy() || presence.pizzaOnTable || cakeOn(t)) { bdNext = t + (FAST ? 20 : 120); return; }
  const crew = sceneCrew();
  if (crew.length < 2) { bdNext = t + (FAST ? 30 : 600); return; }
  const [b, a, ...rest] = shuffle(crew);
  // сценка уже идёт, поэтому объявление не ждёт, пока договорит сосед
  bd = { b, a, guests: rest.length ? rest : [a], at: t, step: 0, seat: null, singAt: 0, blowAt: 0 };
  sceneSay(a, fill(pick(T.birthday.announce), { name: nick(b) }), t);
  sfx.ding();
}

function finish(t: number) {
  const d = bd;
  if (!d) return;
  if (d.seat && d.b.brk?.errand && d.b.brk.spot === d.seat) endBreak(d.b, t);
  if (!blownAt && cakeAt) { blownAt = t; cakeUntil = t + CAKE_TIME; }   // праздник сорвался, но торт остаётся
  bd = null; bdNext = t + (FAST ? 200 : rand(10800, 21600));
}

export function birthdayStep(t: number) {
  // принесли пиццу, а на столе остатки торта: торт убирают, двум блюдам на столе тесно
  if (!bd && blownAt && cakeOn(t) && presence.pizzaOnTable) cakeUntil = t;
  if (!bd) { start(t); return; }
  const d = bd, b = d.b, s2 = t - d.at;
  if (!avail(b) || s2 > 120) { finish(t); return; }              // именинник ушёл домой (или что-то затянулось)
  // поздравляют те, кто сейчас свободен (за это время могли прийти новые), лучше не тот, кто объявил
  if (d.step < 3) for (const x of sceneCrew()) if (x !== b && x !== d.a && !d.guests.includes(x)) d.guests.unshift(x);
  const gs = d.guests.filter(x => x !== b && avail(x)), g0 = gs[0] || (avail(d.a) ? d.a : null), g1 = gs[1] || (avail(d.a) ? d.a : g0);
  const line = (n: number, at: number, fn: () => void) => { if (d.step < n && t > at) { d.step = n; fn(); } };
  // пока идёт праздник, именинник и тот, кто объявил, не болтают о своём
  for (const x of [b, d.a]) x.nextSay = Math.max(x.nextSay, t + 2);
  // торт появляется на кухонном столе, именинник идёт к нему, если табурет свободен
  // (лучше правый: значок занятия над головой тогда не закрывает торт)
  line(1, d.at + 1.8, () => {
    cakeAt = t; cakeUntil = t + 3600; blownAt = 0; sfx.chime();
    const seat = [CAFE[1], CAFE[0]].find(s => !s.owner);
    if (!seat) return;
    if (speech.talkWho?.includes(b)) bus.emit('talk-stop', { who: b });
    if (b.brk) endBreak(b, t);
    seat.owner = b; b.brk = { spot: seat, until: 0, errand: true }; d.seat = seat;
  });
  line(2, d.at + 4.2, () => sceneSay(g0, pick(T.birthday.hb), t));
  line(3, d.at + 7.6, () => sceneSay(g1, Math.random() < 0.35 ? fill(pick(T.birthday.age), { n: Math.round(rand(2, 9)) }) : pick(T.birthday.wish), t));
  if (d.step < 3) return;
  // поют, когда именинник сел к торту (или не дошёл за 25 секунд)
  const seated = !d.seat || (arrived(b) && b.place === d.seat);
  if (!d.singAt) {
    if (s2 > 10.5 && (seated || s2 > 25)) { d.singAt = t; sceneSay(d.a, pick(T.birthday.sing), t); birthdayTune(); }
    return;
  }
  line(4, d.singAt + TUNE_LEN + 0.6, () => { d.blowAt = t; blow(t); });
  if (!d.blowAt) return;
  line(5, d.blowAt + 1.6, () => sceneSay(b, pick(T.birthday.thanks), t));
  line(6, d.blowAt + 5.4, () => sceneSay(g0, pick(T.birthday.cake), t));
  if (t > d.blowAt + 8.5) finish(t);
}

sceneRegistry.add({ name: 'birthday', active: () => !!bd, step: (_dt, t) => birthdayStep(t) });
