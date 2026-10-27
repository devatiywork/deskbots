// Звонок клиента: звонит телефон, агент за столом берёт трубку («AI-офис, слушаю»), слышны только его реплики;
// повесил трубку — сосед спрашивает, что хотел клиент (сценка client).
import { sfx } from '@/shared/audio';
import { FAST, flag } from '@/shared/lib/flags';
import { pick, rand } from '@/shared/lib/random';
import T from '@/shared/i18n/ru/scenes2.json';
import { bus, sceneOn, sceneRegistry, speech } from '@/entities/world';
import { arrived, avail, sceneCrew, sceneSay, type Agent } from '@/entities/agent';

/** a — кто взял трубку, b — кто спросит потом; topic — вопрос клиента и ответ; more — «угу… угу…» посередине */
export interface ClientCall { a: Agent; b: Agent | null; at: number; step: number; topic: string[]; more: boolean }

let call: ClientCall | null = null, callNext = flag('client') ? 12 : FAST ? 70 : rand(3600, 7200);

/** Идущий звонок (null — нет). */
export const clientCall = () => call;

// брифинг старого движка (brief) недоступен: вместо него — его реплики по очереди или сценка 'brief', если зарегистрирована
const busy = () => sceneOn() || speech.briefTalking || sceneRegistry.isActive('brief');
/** Сидит за своим столом, не на перерыве: телефон рядом. */
const atDesk = (a: Agent) => !!a.desk && arrived(a) && a.place === a.desk && !a.brk;

function endCall(t: number) { call = null; callNext = t + (FAST ? 90 : rand(3600, 7200)); }

export function clientStep(t: number) {
  if (!call) {
    if (t < callNext) return;
    if (busy()) { callNext = t + (FAST ? 15 : 60); return; }
    const crew = sceneCrew(), desk = crew.filter(atDesk);
    if (!desk.length) { callNext = t + (FAST ? 30 : 300); return; }
    // трубку берёт тот, кто не ждёт ответа; спросит потом любой другой
    const a = desk.find(x => x.status !== 'waiting') || desk[0], rest = crew.filter(x => x !== a);
    if (speech.talkWho?.includes(a)) bus.emit('talk-stop', { who: a });
    call = { a, b: rest.length ? pick(rest) : null, at: t, step: 0, topic: pick(T.client.topics), more: Math.random() < 0.5 };
    sfx.ring();
    return;
  }
  const c = call, a = c.a, b = c.b && avail(c.b) ? c.b : null, s2 = t - c.at, k = c.more ? 4 : 0;
  if (!avail(a)) { endCall(t); return; }                     // ушёл посреди разговора: звонок сорвался
  a.nextSay = Math.max(a.nextSay, t + 2);                    // с трубкой у уха о своём не болтает
  const line = (n: number, at: number, fn: () => void) => { if (c.step < n && s2 > at) { c.step = n; fn(); } };
  line(1, 1.4, () => { if (b && Math.random() < 0.5) sceneSay(b, pick(T.client.ring), t); });
  line(2, 2.6, () => sfx.ring());
  // взял трубку: над головой значок телефона, пока не повесит
  line(3, 4.8, () => { sfx.click(); sceneSay(a, pick(T.client.hello), t); a.fxChip = { name: 'phone', until: t + 30 }; });
  line(4, 8.8, () => sceneSay(a, c.topic[0], t));
  line(5, 12.8, () => { if (c.more) sceneSay(a, pick(T.client.more), t); });
  line(6, 12.8 + k, () => sceneSay(a, c.topic[1], t));
  line(7, 17.4 + k, () => sceneSay(a, pick(T.client.bye), t));
  line(8, 20.4 + k, () => { sfx.click(); if (a.fxChip?.name === 'phone') a.fxChip.until = t; });   // повесил трубку
  line(9, 21.6 + k, () => sceneSay(b, pick(T.client.ask), t));
  line(10, 25.4 + k, () => { if (b) sceneSay(a, pick(T.client.tell), t); });
  if (s2 > 29 + k) endCall(t);
}

sceneRegistry.add({ name: 'client', active: () => !!call, step: (_dt, t) => clientStep(t) });
