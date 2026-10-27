// Шаг жизни агентов за кадр: перерывы, куда идти, шаг по пути, приветствие, напоминание «жду тебя»,
// болтовня, стажёры; потом распорядок дня, брифинг, чай, отложенные реплики и диалоги.
import { sfx } from '@/shared/audio';
import { pick } from '@/shared/lib/random';
import L from '@/shared/i18n/ru/lines.json';
import { env } from '@/entities/environment';
import { presence, queueTick } from '@/entities/world';
import { agents, arrived, routeTo, say, walk, wanted } from '@/entities/agent';
import { breakTick, noteCafe } from './breaks';
import { briefTick } from './brief';
import { chatTick } from './chat';
import { dayTick } from './day';
import { dialogTick } from './dialogs';
import { internStep } from './interns';
import { teaTick } from './tea';

export function agentsStep(dt: number, t: number) {
  for (const a of [...agents.values()]) {
    a.ph += dt;
    if (a.arriving) continue;                          // ещё едет в машине
    noteCafe(a, t);
    breakTick(a, t);
    if (!a.path.length) {
      // при руководстве никто не отдыхает: все за столами
      const want = a.pending || wanted(a, t, !presence.boss);
      if (want !== a.place) routeTo(a, want);
      if (!a.path.length) a.dir = a.place.face || 'down';
    }
    if (a.path.length) walk(a, dt);
    if (arrived(a) && a.stayPlace !== a.place) { a.stayPlace = a.place; a.stayAt = t; }   // сел на новое место
    if (!a.greeted && arrived(a) && a.place === a.desk) { a.greeted = true; say(a, pick(env.phase === 'night' ? L.helloNight : L.hello), t, false); }
    // ждёт тебя дольше двух минут: напоминает звуком и облачком
    if (a.status === 'waiting' && arrived(a) && t - a.waitAt > 120) { a.waitAt = t; say(a, pick(L.wait), t, true); sfx.ding(); }
    chatTick(a, t);
    internStep(a, dt, t);
  }
  dayTick(t);
  briefTick(t);
  teaTick(t);
  queueTick(t);
  dialogTick(t);
}
