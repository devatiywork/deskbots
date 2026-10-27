// Брифинг раз в 15 минут: все, кто в офисе, собираются в проходе, ведущий спрашивает каждого, что у него.
// Вечером ведущий подводит итоги дня по настоящей статистике (в пятницу — и недели).
// Другие фичи видят брифинг как сценку 'brief' (sceneRegistry.isActive), но он не мешает начаться другим.
import { FAST, has } from '@/shared/lib/flags';
import { fmtBig, plural } from '@/shared/lib/format';
import { pick } from '@/shared/lib/random';
import { fill } from '@/shared/i18n';
import D from '@/shared/i18n/ru/dialogs.json';
import { localNow } from '@/entities/environment';
import { BRIEF_SPOTS, config, sceneOn, sceneRegistry, server, speech } from '@/entities/world';
import { GROUP, agents, arrived, avail, doing, endBreak, say, type Agent } from '@/entities/agent';
import { dropTalkOf } from './dialogs';
import { life, teaWith, voc, type Brief } from './state';

const B = D.brief;
const BRIEF_LEAD = ['claude', 'codex', 'gpt'];
let briefNext = has('brief') ? 6 : FAST ? 40 : 900;

sceneRegistry.add({ name: 'brief', blocks: false, active: () => !!life.brief });

/** Идёт брифинг (сбор или разговор). */
export const briefOn = () => !!life.brief;

const pl = (n: number, w: string[]) => plural(n, w[0], w[1], w[2]);

function startBrief(t: number) {
  if (t < briefNext) return;
  if (sceneOn()) { briefNext = t + 30; return; }
  const team = [...agents.values()].filter(a => avail(a) && a.status !== 'waiting');
  if (team.length < 2) { briefNext = t + 60; return; }
  // ведущий — тот, кто сейчас свободен (Claude, потом Codex, потом GPT)
  const freeNow = team.filter(a => !a.brk && !teaWith(a));
  const lead = BRIEF_LEAD.map(gr => freeNow.find(a => GROUP[a.kind] === gr)).find(Boolean) || freeNow[0];
  if (!lead) { briefNext = t + 20; return; }
  const crew = [lead, ...team.filter(a => a !== lead)].slice(0, BRIEF_SPOTS.length);
  dropTalkOf(...crew);
  const brief: Brief = { at: t, lead, team: [], called: crew.map((a, i) => ({ a, spot: BRIEF_SPOTS[i] })), state: 'gather', i: 0, next: 0, lines: [] };
  life.brief = brief;
  const ls = brief.called[0];
  ls.spot.owner = lead; lead.brk = { spot: ls.spot, until: 0, brief: true }; brief.team.push(lead);
  say(lead, pick(B.call), t, true);
}

/** Реплики брифинга: ведущий открывает, подводит итоги, спрашивает до трёх человек, закрывает. */
function briefLines(brief: Brief, t: number): [Agent, string][] {
  const L = brief.lead, lines: [Agent, string][] = [[L, pick(B.open)]];
  const late = localNow().h >= config.endH - 1 || has('late'), st = server.dayStats, wd = server.weekData;
  // вечером ведущий подводит итоги дня по настоящей статистике, днём иногда хвастается
  if (st && late) lines.push([L, fill(B.dayTotal, { files: pl(st.files, B.files), commands: pl(st.commands, B.commands) })]);
  else if (st && st.files && Math.random() < 0.3) lines.push([L, fill(B.dayBrag, { files: pl(st.files, B.files) })]);
  if (wd && new Date().getDay() === 5 && late) {
    const wk = wd.reduce((s, d) => ({ tokens: s.tokens + d.tokens, commits: s.commits + d.commits }), { tokens: 0, commits: 0 });
    lines.push([L, fill(B.week, { tokens: fmtBig(wk.tokens), commits: pl(wk.commits, B.commits) })]);
  }
  let forgot = false;
  for (const a of brief.team.filter(a => a !== L).slice(0, 3)) {
    lines.push([L, fill(B.ask, { name: voc(a) + (a.tagNo > 1 ? ' ' + a.tagNo : '') })]);
    const idle25 = a.status !== 'working' && a.idleSince !== null && t - a.idleSince > 1500;   // без работы больше 25 минут
    let ans = a.status === 'working' ? doing(a, true) || pick(B.busy) : pick(B.free);
    if (a.kind === 'ollama' && idle25) ans = B.ollamaDone;
    else if (idle25 && !forgot) { ans = B.forgot; forgot = true; }
    else if (a.kind === 'chatgpt' && Math.random() < 0.25) ans = B.gptJoke;
    lines.push([a, ans]);
  }
  lines.push([L, pick(B.close)]);
  return lines;
}

export function briefTick(t: number) {
  const brief = life.brief;
  if (!brief) { startBrief(t); return; }
  // позванные идут на брифинг, когда закончили своё: допили, договорили, отдали чай
  for (const c of brief.called) {
    const a = c.a;
    if (!avail(a) || a.status === 'waiting') { c.done = true; continue; }
    if (c.done || a.brk?.brief) continue;
    const ch = a.brk?.chat, midChat = !!ch && ch.i < ch.lines.length;
    const busyNow = (a.say && a.say.until > t) || midChat || teaWith(a) || (a.brk && !arrived(a))
      || (a.brk && a.brk.until > t && a.brk.until - t < 20);              // допивает кофе: недолго, пусть допьёт
    if (busyNow && t - brief.at < 50) continue;
    const wasBusy = !!a.brk;
    if (a.brk) endBreak(a, t);
    a.carry = false; a.teaWait = false;
    c.spot.owner = a; a.brk = { spot: c.spot, until: 0, brief: true };
    brief.team.push(a);
    if (a !== brief.lead && wasBusy) say(a, pick(B.coming), t, true);
  }
  brief.team = brief.team.filter(a => agents.has(a.id) && a.brk?.brief);
  const waiting = brief.called.some(c => !c.done && !c.a.brk?.brief);
  if (!brief.team.includes(brief.lead) || (!waiting && brief.team.length < 2)) { endBrief(t); return; }
  if (brief.state === 'gather') {
    if ((waiting || !brief.team.every(a => arrived(a) && a.place === a.brk?.spot)) && t - brief.at < 70) return;
    if (brief.team.length < 2) { endBrief(t); return; }
    for (const c of brief.called) c.done = true;                // кто не успел, тот пропускает
    Object.assign(brief, { state: 'talk', lines: briefLines(brief, t), next: t + 0.6 });
    speech.briefTalking = true;
    return;
  }
  if (t < brief.next) return;
  if (brief.i >= brief.lines.length) { endBrief(t); return; }
  const [who, text] = brief.lines[brief.i++];
  if (brief.team.includes(who)) { speech.cafeLine = true; say(who, text, t, true); speech.cafeLine = false; who.nextSay = t + 10; }
  brief.next = t + 3.8;
}

function endBrief(t: number) {
  const brief = life.brief;
  if (brief) for (const a of brief.team) if (a.brk?.brief) endBreak(a, t);
  for (const s of BRIEF_SPOTS) if (s.owner && !(s.owner as Partial<Agent>).brk?.brief) s.owner = null;
  life.brief = null; speech.briefTalking = false;
  briefNext = t + (FAST ? 60 : 900);
}
