// Кто может участвовать в сценке, у кого лимит, что говорить в праздник.
import { env } from '@/entities/environment';
import { server } from '@/entities/world';
import L from '@/shared/i18n/ru/lines.json';
import { agents, arrived, avail, type Agent } from './agent';
import { GROUP } from './kinds';

/** Свободные агенты в офисе: не за столиком в кофейне, не на брифинге, не на поручении. */
export const sceneCrew = (): Agent[] =>
  [...agents.values()].filter(a => avail(a) && arrived(a) && !a.brk?.cafe && !a.brk?.brief && !a.brk?.errand);

/** У кого лимит на исходе (near) или кончился (limited). Claude и приложение Claude делят одну подписку. */
export function limitFor(a: Agent): '' | 'near' | 'limited' {
  const g = GROUP[a.kind], lim = server.limits;
  if (g === 'claude') { const c = lim?.claude; if (c?.limited) return 'limited'; if ((c?.pct ?? 0) >= 80) return 'near'; }
  if (g === 'codex') {
    const c = lim?.codex, t = Date.now();
    const p5 = c?.five && c.five.reset > t ? c.five.pct : 0, pw = c?.week && c.week.reset > t ? c.week.pct : 0;
    if ((c as { reached?: boolean } | undefined)?.reached || p5 >= 100 || pw >= 100) return 'limited';
    if (Math.max(p5, pw) >= 80) return 'near';
  }
  return '';
}

/** Праздничные реплики на сегодня (в январе — «С Новым годом!», в декабре — «С наступающим!»). */
export function holidayLines(): string[] {
  const h = env.holiday;
  if (!h) return [];
  if (h === 'ny' && new Date().getMonth() === 0) return L.holiday.ny2;
  return L.holiday[h];
}
