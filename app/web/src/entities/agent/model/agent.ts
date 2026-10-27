// Агент — открытая ИИ-программа на компьютере (Claude Code, Codex, ChatGPT, Ollama…). Приезжает на своей машине,
// сидит за столом, пока работает, отдыхает в чилл-зоне, ходит за кофе, уезжает, когда программу закрыли.
import { FAST } from '@/shared/lib/flags';
import { rand } from '@/shared/lib/random';
import A from '@/shared/i18n/ru/agent.json';
import {
  CAFE, CHILL, DESKS, V, crowd, curbPlace, spotOf, zoneOfPlace,
  type Desk, type Face, type Place, type Pt, type Speech,
} from '@/entities/world';
import { KIND, OTHER_AI } from './kinds';

export type Status = 'working' | 'waiting' | 'idle';
export type Ride = 'taxi' | 'tesla' | 'limo';

/** Разговор двоих за столиком: реплики по очереди. */
export interface Chat { lines: string[]; i: number; next: number; who: Agent[]; used: string[][] }

/** Перерыв: куда пошёл и до какого времени; cafe — с кем за столиком; brief, errand, pizza — особые поручения. */
export interface Break { spot: Place; until: number; cafe?: Agent; chat?: Chat; brief?: boolean; errand?: boolean; pizza?: boolean }

export interface Agent {
  id: string; kind: string; name: string; status: Status;
  tool: string; detail: string; hooks: boolean; subsWant: number; sinceAt: number; folder: string; files?: Set<string>;
  /** номер на табличке, если открыто несколько одинаковых */
  tagNo: number;
  place: Place; x: number; y: number; path: Pt[]; pending: Place | null;
  desk: Desk | null; spot: Place | null; brk: Break | null;
  leaving: boolean; leavePlace?: Place; arriving: boolean; exitAt?: number; ride?: Ride;
  nextBreak: number; nextOut: number; nextSay: number; say: Speech | null; greeted: boolean;
  dir: Face; ph: number; idleSince: number | null; workSince: number | null; waitAt: number;
  stayPlace?: Place; stayAt?: number; labelY?: number;
  // чай от GPT, пицца, значок над головой после события от хука, звуки занятий
  carry?: boolean; lemon?: boolean; teaWait?: boolean; teaCup?: number; pizzaBox?: boolean;
  fxChip?: { name: string; until: number }; reactAt?: number; sndAt?: number;
  interns?: import('../ui/intern').Intern[];   // стажёры-субагенты у стола: ведёт фича, рисует drawIntern
}

export const agents = new Map<string, Agent>();
crowd.add(() => agents.values());

/** секунд без работы, после которых агент идёт отдыхать */
export const IDLE_TO_CHILL = FAST ? 6 : 40;
/** на диване засыпает после стольких секунд без работы */
export const IDLE_TO_SLEEP = 300;
/** как часто работающий агент ходит за кофе или чаем */
export const breakGap = () => (FAST ? rand(10, 20) : rand(180, 480));
/** как часто отдыхающий агент выходит на лавочку или зовёт в кофейню */
export const outGap = () => (FAST ? rand(12, 22) : rand(240, 600));
/** сам агент никуда не срывается, пока не побыл на месте хотя бы столько секунд */
export const MIN_STAY = FAST ? 5 : 30;

/** Новый агент приезжает на машине: пока она не остановилась у входа, его не видно. */
export function newAgent(s: { id: string; kind: string; name: string; status: Status; tool?: string }, t: number): Agent {
  const a: Agent = {
    id: s.id, kind: KIND[s.kind] ? s.kind : 'claude', name: s.name, status: s.status, tool: s.tool || '', detail: '', hooks: false,
    subsWant: 0, sinceAt: 0, folder: '', tagNo: 1,
    place: curbPlace(), x: 192, y: 179, path: [], pending: null, desk: null, spot: null, leaving: false, arriving: true, brk: null,
    nextBreak: t + (FAST ? 8 : rand(90, 240)), nextOut: t + outGap(), nextSay: t + rand(4, 10), say: null, greeted: false,
    dir: 'down', ph: Math.random() * 6, idleSince: s.status === 'idle' ? t : null, workSince: s.status === 'working' ? t : null, waitAt: t,
  };
  agents.set(s.id, a);
  return a;
}

export const arrived = (a: Agent) => !a.path.length && !a.pending;
export const sitting = (a: Agent) => arrived(a) && !!a.place.sit;
export const atCurb = (a: Agent) => a.leaving && arrived(a) && !!a.place.street;
export const avail = (a: Agent) => agents.has(a.id) && !a.leaving && !a.arriving;
export const free = (a: Agent) => !a.leaving && !a.arriving && !a.brk && arrived(a);
export const settled = (a: Agent, t: number) => arrived(a) && a.stayPlace === a.place && t - (a.stayAt ?? t) >= MIN_STAY;
export const resting = (a: Agent, t: number) =>
  free(a) && a.status === 'idle' && a.idleSince !== null && t - a.idleSince > IDLE_TO_CHILL && !!a.spot && a.place === a.spot;
export const zoneOf = (a: Agent) => zoneOfPlace(a.place);
/** Агент пишет в окне чата, а не в коде: ChatGPT, приложение Claude и другие ИИ без хуков. */
export const inChat = (a: Agent) => (a.kind === 'chatgpt' || a.kind === 'claude-app' || OTHER_AI.includes(a.kind)) && !a.hooks;

/** Идти к месту: назад по своему пути до прохода, по коридору в нужный проход, дальше к месту. */
export function routeTo(a: Agent, place: Place) {
  if (a.path.length) { a.pending = place; return; }
  const from = a.place;
  if (from.out && place.street) { a.path = [{ x: from.entry.at(-2)!.x, y: 174 }, { x: 192, y: 174 }, { x: 192, y: 179 }]; a.place = place; a.pending = null; return; }
  const pts = [...from.entry].reverse().slice(1);
  if (from.lane !== place.lane) pts.push({ x: V, y: from.lane }, { x: V, y: place.lane });
  pts.push(...place.entry);
  a.path = pts; a.place = place; a.pending = null;
}

/**
 * Куда агенту надо сейчас: уходит — к бордюру; на перерыве — на место перерыва; работает или ждёт чай — за стол;
 * давно без дела — в чилл-зону (если не rest=false: при руководстве все за столами).
 */
export function wanted(a: Agent, t: number, mayRest = true): Place {
  if (a.leaving) return a.leavePlace!;
  if (!a.desk) { a.desk = DESKS.find(d => !d.owner) || null; if (a.desk) a.desk.owner = a; }
  if (a.brk) return a.brk.spot;
  if (a.desk && (a.teaWait || (a.teaCup ?? 0) > t)) return a.desk;
  const rest = mayRest && a.status === 'idle' && a.idleSince !== null && t - a.idleSince > IDLE_TO_CHILL;
  if (!rest && a.desk) { if (a.spot) { a.spot.owner = null; a.spot = null; } return a.desk; }
  if (!a.spot) { a.spot = CHILL.find(s => !s.owner) || null; if (a.spot) a.spot.owner = a; }
  return a.spot || a.desk || a.place;
}

export function endBreak(a: Agent, t: number) {
  if (!a.brk) return;
  if (a.spot !== a.brk.spot) a.brk.spot.owner = null;
  a.brk = null; a.nextBreak = t + breakGap();
}

/** Уходящий агент освобождает стол и места и идёт к бордюру, там его ждёт своя машина. */
export function leave(a: Agent) {
  if (a.arriving) { agents.delete(a.id); return; }
  a.leaving = true; a.leavePlace = curbPlace();
  if (a.desk) { a.desk.owner = null; a.desk = null; }
  if (a.brk) { if (a.spot !== a.brk.spot) a.brk.spot.owner = null; a.brk = null; }
  if (a.spot) { a.spot.owner = null; a.spot = null; }
}

/** Шаг по пути со скоростью 34 клетки в секунду. */
export function walk(a: Agent, dt: number) {
  const p = a.path[0], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy), v = 34 * dt;
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) a.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  if (d <= v) { a.x = p.x; a.y = p.y; a.path.shift(); } else { a.x += (dx / d) * v; a.y += (dy / d) * v; }
}

/** Чем агент сейчас занят: от этого зависят значок над головой, строка в панели и звуки. */
export function activity(a: Agent, t: number): string {
  if (a.arriving) return 'ride';
  if (atCurb(a)) return 'cab';
  if (a.leaving || !arrived(a)) return 'walk';
  if (a.brk) return a.brk.cafe ? 'cafe' : a.brk.spot.act || 'desk';
  if (a.place.desk) return a.status === 'working' ? 'work' : a.status === 'waiting' ? 'wait' : (a.teaCup ?? 0) > t ? 'tea' : 'desk';
  if (a.status === 'waiting') return 'wait';
  if (a.place.act === 'tv' && a.idleSince !== null && t - a.idleSince > IDLE_TO_SLEEP) return 'sleep';
  return a.place.act || 'desk';
}

/** Что делает по хукам: «правит JournalPage.tsx», «терминал: git push», «пишет ответ в чате»; first — от первого лица. */
export function doing(a: Agent, first = false): string {
  if (inChat(a)) return a.status === 'working' ? (first ? A.chat.workingFirst : A.chat.working) : '';
  if (a.kind === 'ollama') return a.status === 'working' ? (first ? `${A.local.workingFirst}${a.detail ? ' · ' + a.detail : ''}` : A.local.working) : '';
  if (!a.tool) return '';
  const v = (A.tools as Record<string, string[]>)[a.tool], d = a.detail, quote = /^(Grep|WebSearch|думает)$/.test(a.tool);
  const verb = v ? v[first ? 1 : 0] : a.tool;
  if (!d) return a.tool === 'думает' ? (first ? A.thinking.workingFirst : A.thinking.working) : verb.replace(/:$/, '');
  return `${verb} ${quote ? `«${d}»` : d}`;
}

/** Строка состояния для панели. */
export function actLabel(a: Agent, act: string): string {
  if (act === 'work' && doing(a)) return doing(a);
  const ride = A.ride[a.ride || 'taxi'];
  if (act === 'ride') return ride[0];
  if (act === 'cab') return ride[1];
  return (A.acts as Record<string, string>)[act] || '';
}

export const shortName = (a: Agent) => ((A.short as Record<string, string>)[a.kind] || 'AI') + (a.tagNo > 1 ? a.tagNo : '');
export const nick = (a: Agent) => (A.nick as Record<string, string>)[a.kind] || shortName(a);

/** Сидит на диване в чилл-зоне: таблички соседей приподнимаются через одну. */
export const onSofa = (a: Agent) => arrived(a) && !!a.place.sit && !a.place.desk && a.place.lane === 82;
export const sofaShift = (a: Agent) => onSofa(a) && CHILL.indexOf(a.place) % 2 === 1;
export const cafeRight = (a: Agent) => !!a.brk?.cafe && arrived(a) && a.place === CAFE[1];
export { spotOf };
