// Человек вышел из полноэкранной программы (или игры), и обои снова видно: офис «заметил» его
// и делает вид, что работает. Не чаще 2 раз за 2 минуты и только после паузы от 5 секунд.
import { pick } from '@/shared/lib/random';
import D from '@/shared/i18n/ru/dialogs.json';
import { later, now, sceneOn } from '@/entities/world';
import { agents, arrived, avail, say } from '@/entities/agent';
import { hushTalk } from './dialogs';
import { life } from './state';

const reveals: number[] = [];

/** pausedAt — когда офис спрятали или поставили на паузу (performance.now(), мс). */
export function onReveal(pausedAt = 0) {
  const t = now();
  if (performance.now() - pausedAt < 5000) return;
  while (reveals.length && t - reveals[0] > 120) reveals.shift();
  if (reveals.length >= 2 || sceneOn() || life.brief) return;
  const here = [...agents.values()].filter(a => avail(a) && arrived(a) && !a.brk?.cafe && a.status !== 'waiting');
  if (!here.length) return;
  reveals.push(t);
  hushTalk();
  const a = pick(here), b = pick(here.filter(x => x !== a)) || a;
  say(a, pick(D.reveal.spot), t + 0.6, true);
  later(t + 4.4, () => { if (avail(b)) say(b, pick(D.reveal.pretend), now(), true); });
}
