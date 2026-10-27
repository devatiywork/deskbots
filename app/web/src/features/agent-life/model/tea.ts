// «Холодно!» от Клода: GPT идёт делать ему чай (в 20% — с лимоном), Клод садится за стол и ждёт.
// GPT заваривает у кулера, несёт чашку к столу Клода, Клод благодарит.
import { sfx } from '@/shared/audio';
import { has } from '@/shared/lib/flags';
import L from '@/shared/i18n/ru/lines.json';
import D from '@/shared/i18n/ru/dialogs.json';
import { CHILL, bus } from '@/entities/world';
import { GROUP, agents, arrived, avail, endBreak, say, type Agent } from '@/entities/agent';
import { dropTalkOf } from './dialogs';
import { asAgent, life } from './state';

/** кулер с кипятком */
const kettle = CHILL[9];
const T = D.tea;

function teaOrder(c: Agent, t: number) {
  if (life.tea || life.brief || !c.desk || c.brk || !avail(c)) return;
  const g = [...agents.values()].find(x => x.kind === 'chatgpt' && avail(x) && !x.brk && x.status !== 'waiting');
  if (!g || kettle.owner) return;
  life.tea = { c, g, state: 'ask', at: t + 2.6, lemon: Math.random() < (has('lemon') ? 1 : 0.2) };
}

bus.on('said', ({ who, text, t }) => {
  const a = asAgent(who);
  if (a && GROUP[a.kind] === 'claude' && text === L.cold) teaOrder(a, t);
});

export function teaTick(t: number) {
  const tea = life.tea;
  if (!tea) return;
  const { c, g } = tea;
  const stop = () => { if (g.brk?.errand) endBreak(g, t); g.carry = false; c.teaWait = false; life.tea = null; };
  if (!avail(c) || !avail(g) || life.brief || (tea.state !== 'ask' && !g.brk?.errand)) { stop(); return; }
  if (tea.state === 'ask') {
    if (t < tea.at) return;
    if (kettle.owner || g.brk) { life.tea = null; return; }
    dropTalkOf(c, g);
    say(c, T.ask, t, true);
    kettle.owner = g; g.brk = { spot: kettle, until: 0, errand: true };
    c.teaWait = true;
    tea.state = 'reply'; tea.at = t + 2.6;
    return;
  }
  if (tea.state === 'reply') {
    if (t < tea.at) return;
    say(g, tea.lemon ? T.replyLemon : T.reply, t, true);
    tea.state = 'brew'; tea.at = 0;
    return;
  }
  const gb = g.brk!;                                   // GPT на поручении (проверено выше)
  if (tea.state === 'brew') {
    if (!(arrived(g) && g.place === kettle)) return;
    if (!tea.at) { tea.at = t + 3.5; sfx.pour(); return; }
    if (t < tea.at) return;
    // несёт чашку к столу Клода и встаёт рядом
    const d = c.desk;
    if (!d) { stop(); return; }
    const x = d.cx + 10;
    kettle.owner = null;
    gb.spot = { lane: d.lane, entry: [{ x, y: d.lane + 2 }], face: 'up', sit: false, act: 'serve', owner: g };
    g.carry = true; g.lemon = tea.lemon;
    tea.state = 'carry'; tea.at = t + 40;
    return;
  }
  if (tea.state === 'carry') {
    const there = arrived(g) && g.place === gb.spot, seated = arrived(c) && c.place === c.desk;
    if (t > tea.at) { stop(); return; }
    if (!there || !seated) return;
    say(g, tea.lemon ? T.giveLemon : T.give, t, true);
    g.carry = false; c.teaCup = t + 30; c.lemon = tea.lemon; c.teaWait = false;
    tea.state = 'thanks'; tea.at = t + 2.6;
    return;
  }
  if (t < tea.at) return;
  say(c, tea.lemon ? T.thanksLemon : T.thanks, t, true);
  endBreak(g, t); life.tea = null;
}
