// Диалоги между агентами: GPT и Claude подкалывают друг друга, Codex — начальник GPT, лама Ollama — локальная;
// плюс разговоры по настоящей работе (кто что правит, кто ждёт тебя, кто пушит) и изредка круг шуток.
// Участники идущего диалога видны другим через speech.talkWho; если другая фича сбросила его — диалог окончен.
import { FAST, has } from '@/shared/lib/flags';
import { pick, rand, shuffle } from '@/shared/lib/random';
import { fill } from '@/shared/i18n';
import L from '@/shared/i18n/ru/lines.json';
import D from '@/shared/i18n/ru/dialogs.json';
import { bus, later, now, speech } from '@/entities/world';
import { GROUP, agents, arrived, avail, clash, doing, inChat, say, zoneOf, type Agent } from '@/entities/agent';
import { asAgent, sceneQuiet, voc } from './state';

interface Talk { who: Agent[]; lines: string[]; i: number; next: number }
/** идущий диалог двоих: реплики по очереди */
let talk: Talk | null = null;
let nextTalk = FAST ? 14 : 20;

function setTalk(v: Talk | null) { talk = v; speech.talkWho = v ? v.who : null; }
/** Прервать диалог, если в нём кто-то из них (брифинг, чай забирают участника). */
export function dropTalkOf(...who: Agent[]) { if (talk && talk.who.some(x => who.includes(x))) setTalk(null); }
/** Прервать диалог и убрать его облачка (офис «заметил», что на него смотрят). */
export function hushTalk() {
  if (!talk) return;
  for (const a of talk.who) if (a.say?.talk) a.say = null;
  setTalk(null);
}

const DIALOGS = D.dialogs as { a?: string; b?: string; lines: string[] }[];

// разговоры по работе: a и b — группы того, кто спрашивает, и того, кто отвечает; тексты в dialogs.json (work, по несколько вариантов)
const busy = (a: Agent) => a.status === 'working';
const W = D.workWords;
interface WorkDialog {
  key: keyof typeof D.work; a?: string; b?: string;
  when: (x: Agent, y: Agent) => boolean;
  params?: (x: Agent, y: Agent) => Record<string, string | number>;
}
const WORK_DIALOGS: WorkDialog[] = [
  { key: 'files', a: 'gpt', b: 'claude', when: (_x, y) => busy(y) && (y.files?.size ?? 0) >= 2, params: (_x, y) => ({ n: y.files!.size, detail: y.detail || W.files }) },
  { key: 'claudeDoing', a: 'gpt', b: 'claude', when: (_x, y) => busy(y) && !!y.detail, params: (_x, y) => ({ doing: doing(y, true) }) },
  { key: 'report', a: 'codex', b: 'gpt', when: (_x, y) => busy(y), params: (_x, y) => ({ doing: doing(y, true) || W.report }) },
  { key: 'idle', a: 'codex', b: 'gpt', when: (_x, y) => !busy(y) },
  { key: 'bossDoing', a: 'gpt', b: 'codex', when: (_x, y) => busy(y) && !!y.detail, params: (_x, y) => ({ doing: doing(y, true) }) },
  { key: 'inChat', a: 'claude', b: 'gpt', when: (_x, y) => busy(y) && inChat(y) },
  { key: 'waiting', when: (_x, y) => y.status === 'waiting', params: (_x, y) => ({ name: voc(y) }) },
  { key: 'push', when: (_x, y) => /^git push/.test(y.detail), params: (_x, y) => ({ detail: y.detail }) },
  { key: 'thinking', when: (_x, y) => y.tool === 'думает' && !!y.detail, params: (_x, y) => ({ name: voc(y), detail: y.detail }) },
  { key: 'bothBusy', when: (x, y) => busy(x) && busy(y) },
];

/** Изредка все по очереди шутят (до четырёх человек): двое рассказывают, остальные смеются. */
function jokeRound(here: Agent[], t: number) {
  const crew = shuffle(here).slice(0, 4), jk = shuffle(D.jokes);
  crew.forEach((a, i) => later(t + 0.3 + i * 4.2, () => { if (avail(a)) say(a, i < 2 ? jk[i] : pick(D.jokeReplies), now(), true); }));
  nextTalk = t + crew.length * 4.2 + 30;
}

/** Может говорить в диалоге: в офисе, на месте, не за столиком, не на брифинге, не на поручении. */
const ok = (a: Agent) => agents.has(a.id) && !a.arriving && !a.leaving && !a.brk?.cafe && !a.brk?.brief && !a.brk?.errand && arrived(a);

export function dialogTick(t: number) {
  // другая фича сбросила speech.talkWho вместо события talk-stop: диалог тоже окончен
  if (talk && speech.talkWho !== talk.who) talk = null;
  const tk = talk;
  if (tk) {
    // кто-то ушёл или пересел в другую часть офиса: разговор обрывается, их реплики исчезают
    if (!tk.who.every(ok) || zoneOf(tk.who[0]) !== zoneOf(tk.who[1])) {
      for (const a of tk.who) if (a.say?.talk && !a.leaving) a.say = null;
      setTalk(null); nextTalk = t + 20; return;
    }
    if (t < tk.next) return;
    const sp = tk.who[tk.i % 2], line = tk.lines[tk.i];
    if (clash(sp, line, t, tk.who)) { tk.next = t + 0.5; return; }               // рядом говорит кто-то другой: ждём
    for (const w of tk.who) if (w !== sp && w.say?.talk) w.say = null;           // прошлая реплика собеседника уже прочитана
    say(sp, line, t, true);
    if (!sp.say) return;
    sp.say.talk = true; sp.nextSay = t + 12;
    if (++tk.i >= tk.lines.length) { setTalk(null); nextTalk = t + (FAST ? rand(15, 25) : rand(90, 220)); }
    else tk.next = t + 3.8;
    return;
  }
  if (t < nextTalk || sceneQuiet()) return;
  nextTalk = t + 10;
  const here = [...agents.values()].filter(ok);
  const pairs: Agent[][] = [];
  for (const x of here) for (const y of here) if (x !== y && zoneOf(x) === zoneOf(y)) pairs.push([x, y]);
  if (!pairs.length) return;
  // редко (5%) все по очереди шутят
  if (Math.random() < (has('jokes') ? 1 : 0.05)) { jokeRound(here, t); return; }
  const work: { who: Agent[]; lines: string[] }[] = [];
  for (const d of WORK_DIALOGS) for (const [x, y] of pairs) {
    if ((d.a && GROUP[x.kind] !== d.a) || (d.b && GROUP[y.kind] !== d.b) || !d.when(x, y)) continue;
    const p = d.params?.(x, y) ?? {};
    work.push({ who: [x, y], lines: pick(D.work[d.key]).map(s => fill(s, p)) });
  }
  if (work.length && Math.random() < 0.6) { const f = pick(work); setTalk({ who: f.who, lines: f.lines, i: 0, next: t }); return; }
  const fits: { who: Agent[]; lines: string[] }[] = [];
  for (const d of DIALOGS) {
    if (!d.a) { fits.push({ who: pick(pairs), lines: d.lines }); continue; }
    const m = pairs.filter(([x, y]) => GROUP[x.kind] === d.a && GROUP[y.kind] === d.b);
    if (m.length) fits.push({ who: pick(m), lines: d.lines }, { who: pick(m), lines: d.lines });   // адресные чаще
  }
  const f = pick(fits);
  setTalk({ who: f.who, lines: f.lines, i: 0, next: t });
}

// сценка позвала участника (заказ пиццы): диалог его пары обрывается
bus.on('talk-stop', ({ who }) => { const a = asAgent(who); if (a) dropTalkOf(a); });

// Клод спрашивает «Что дальше?» — Codex иногда (10%, #puss — всегда) отвечает «Кот в сапогах»
bus.on('said', ({ who, text, t }) => {
  const a = asAgent(who);
  if (!a || GROUP[a.kind] !== 'claude' || text !== L.whatNext) return;
  const cx = [...agents.values()].find(x => x.kind === 'codex' && avail(x));
  if (cx && Math.random() < (has('puss') ? 1 : 0.1)) later(t + 2.6, () => { if (avail(cx)) say(cx, L.pussInBoots, now(), true); });
});
