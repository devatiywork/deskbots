// Список программ от сервера → агенты: новые приезжают, закрытые уходят домой с прощанием,
// «ждёт тебя» — звонок и облачко, у одинаковых — номера на табличках.
import { sfx } from '@/shared/audio';
import { pick } from '@/shared/lib/random';
import type { AgentState } from '@/shared/api/types';
import L from '@/shared/i18n/ru/lines.json';
import { now } from '@/entities/world';
import { agents, leave, newAgent, say, type Agent } from '@/entities/agent';
import { homeWhy } from './day';

/** Уходит домой: без дела по распорядку — «Раз тебя нет, я домой», иначе прощание и своя машина. */
function goHome(a: Agent, t: number) {
  const arriving = a.arriving;
  leave(a);
  if (arriving) return;                                // ещё не вышел из машины: просто уезжает
  const why = homeWhy();
  say(a, pick(why && a.status === 'idle' ? L.home[why] : [...L.bye, ...L.byeRide[a.ride || 'taxi']]), t, true);
}

/** Применить список программ (после showFilter и homeFilter). */
export function syncAgents(list: AgentState[]) {
  const t = now(), seen = new Set<string>();
  for (const s of list) {
    seen.add(s.id);
    const a = agents.get(s.id) || newAgent(s, t);
    a.name = s.name; a.tool = s.tool || ''; a.detail = s.detail || ''; a.hooks = !!s.hooks;
    a.subsWant = s.subs || 0; a.sinceAt = s.since ? t - s.since / 1000 : 0; a.folder = String(s.name || '').split(' · ')[1] || '';
    if (a.detail && /^(Edit|MultiEdit|Write|NotebookEdit)$/.test(a.tool)) (a.files ||= new Set()).add(a.detail);
    if (a.status !== s.status) {
      a.status = s.status; a.idleSince = s.status === 'idle' ? t : null; a.workSince = s.status === 'working' ? t : null; a.waitAt = t;
      if (s.status === 'waiting' && !a.arriving) { say(a, pick(L.wait), t, true); sfx.ding(); }
    }
    a.leaving = false;
  }
  for (const a of [...agents.values()]) if (!seen.has(a.id) && !a.leaving) goHome(a, t);
  // номера на табличках, если открыто несколько одинаковых
  const count: Record<string, number> = {};
  for (const a of [...agents.values()].filter(x => !x.leaving)) { count[a.kind] = (count[a.kind] || 0) + 1; a.tagNo = count[a.kind]; }
}
