// Игра на весь экран и созвон (данные от сервера). Агенты замечают: про игру — не чаще раза в 10 минут,
// на созвоне все замолкают и один шепчет «Тсс» — не чаще раза в 5 минут. Громкость после вызова пересчитывает страница.
import L from '@/shared/i18n/ru/lines.json';
import { pick } from '@/shared/lib/random';
import { config, later, now, server } from '@/entities/world';
import { agents, avail, say, sceneCrew, type Agent } from '@/entities/agent';

let gameSaidAt = -999, callSaidAt = -999;

/** Новые режимы от сервера: game — игра или видео на весь экран, mic — микрофон занят. */
export function setModes(game: boolean, mic: boolean) {
  const t = now();
  if (game !== server.gameOn) {
    server.gameOn = game;
    const a: Agent | undefined = pick(sceneCrew());
    if (config.gameQuiet && a && t - gameSaidAt > 600) {
      gameSaidAt = t;
      later(t + (game ? 0.5 : 2), () => avail(a) && say(a, pick(game ? L.userGame : L.userGameEnd), now(), true));
    }
  }
  if (mic !== server.micOn) {
    server.micOn = mic;
    const a: Agent | undefined = pick(sceneCrew());
    if (mic && config.callMute && a && t - callSaidAt > 300) {
      callSaidAt = t;
      for (const x of agents.values()) if (!x.brk?.brief) x.say = null;
      say(a, pick(L.call), t, true);
    }
  }
}
