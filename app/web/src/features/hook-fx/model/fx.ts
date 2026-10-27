// События от хуков: упало, тесты, коммит, push, лимит, новый кубок. Агент отвечает значком над головой,
// репликой и звуком; каждое сыгранное событие уходит в шину hook-fx (руководство ругает красные тесты, хвалит push).
import { sfx } from '@/shared/audio';
import type { OfficeFx } from '@/shared/api/types';
import L from '@/shared/i18n/ru/lines.json';
import { pick } from '@/shared/lib/random';
import { bus, later, now } from '@/entities/world';
import { agents, arrived, avail, say, type Agent } from '@/entities/agent';
import { confetti } from './confetti';
import { queueTrophy } from './trophies';

let fxSeen = -1;

/** Новые события из ответа сервера (номер n растёт): играются по порядку, уже виденные пропускаются. */
export function fxIntake(list: OfficeFx[]) {
  const top = list.reduce((m, e) => Math.max(m, e.n), 0);
  if (fxSeen < 0 || top < fxSeen) { fxSeen = top; return; }   // после перезагрузки обоев или сервера старые события не повторяем
  for (const e of list.filter(e => e.n > fxSeen).sort((a, b) => a.n - b.n)) fxPlay(e);
  fxSeen = top;
}

// значок над головой; реплика и звук не чаще раза в 10 секунд, чтобы череда ошибок не превращалась в шум
function react(a: Agent, chipName: string, lines: readonly string[], t: number, snd?: () => void) {
  a.fxChip = { name: chipName, until: t + 5 };
  if (a.reactAt && t - a.reactAt < 10) return;
  a.reactAt = t; a.say = null; say(a, pick(lines), t, true); snd?.();
}

/** Сыграть одно событие: кубок — в очередь шкафа, остальное — реакция агента, который его вызвал. */
export function fxPlay(e: OfficeFx) {
  const t = now(), a = e.agent ? agents.get(e.agent) : undefined;
  if (e.type === 'trophy') { if (e.id) queueTrophy(e.id); return; }
  if (!a || !avail(a)) return;
  switch (e.type) {
    case 'fail': case 'build-fail': case 'commit-fail': case 'push-fail': react(a, 'bang', L.fail, t, () => sfx.fail()); break;
    case 'test-fail': react(a, 'bang', L.testFail, t, () => sfx.fail()); break;
    case 'test-ok': react(a, 'check', L.testOk, t, () => sfx.chime()); break;
    case 'build-ok': react(a, 'check', L.buildOk, t); break;
    case 'commit-ok': react(a, 'check', L.commit, t, () => sfx.chime()); break;
    case 'push-ok': {
      a.reactAt = 0; react(a, 'check', L.push, t, () => sfx.gong()); confetti(a.x, a.y - 16, 46);
      // кто-нибудь из соседей поздравляет
      const b: Agent | undefined = pick([...agents.values()].filter(x => x !== a && avail(x) && arrived(x)));
      if (b) later(t + 2.2, () => avail(b) && say(b, pick(L.cheer), now(), true));
      break;
    }
    case 'limit': react(a, 'bang', L.limited, t); break;
  }
  bus.emit('hook-fx', { type: e.type, agentId: a.id });
}
