// Отключение света: темнота, мониторы гаснут, Codex запускает генератор, через полминуты свет дают (сценка outage).
import { sfx } from '@/shared/audio';
import { FAST, has } from '@/shared/lib/flags';
import { pick, rand } from '@/shared/lib/random';
import T from '@/shared/i18n/ru/scenes.json';
import { sceneOn, sceneRegistry, speech } from '@/entities/world';
import { avail, sceneCrew, sceneSay, type Agent } from '@/entities/agent';

/** step — сколько реплик сказано; gen — генератор запущен; crew — кто был в офисе, когда погас свет */
export interface Outage { at: number; step: number; gen: boolean; crew: Agent[] }

let outage: Outage | null = null, outageNext = has('outage') ? 15 : FAST ? 100 : rand(4800, 9600);

/** Идёт отключение (и при генераторе тоже): настольные лампы не горят. */
export const outageOn = () => !!outage;
/** До генератора темно и мониторы погасли. */
export const powerOff = () => !!outage && !outage.gen;
/** Генератор гудит: громче низкий гул в звуке улицы. */
export const generatorOn = () => !!outage?.gen;

// брифинг старого движка (brief) недоступен: вместо него — его реплики по очереди или сценка 'brief', если зарегистрирована
const busy = () => sceneOn() || speech.briefTalking || sceneRegistry.isActive('brief');

export function outageStep(t: number) {
  if (!outage) {
    if (t < outageNext) return;
    if (busy()) { outageNext = t + 120; return; }
    const crew = sceneCrew();
    if (!crew.length) { outageNext = t + 300; return; }
    outage = { at: t, step: 0, gen: false, crew };
    sfx.pop();
    return;
  }
  const o = outage, s2 = t - o.at, c = o.crew.filter(x => avail(x)), a = c[0], b = c[1] || a;
  // в старом движке эти реплики звались без t и облачко не гасло; здесь — с текущим временем
  const line = (n: number, at: number, fn: () => void) => { if (o.step < n && s2 > at) { o.step = n; fn(); } };
  line(1, 0.6, () => sceneSay(a, pick(T.outage.dark), t));
  line(2, 4, () => sceneSay(b, pick(T.outage.react), t));
  line(3, 8, () => sceneSay(c.find(x => x.kind === 'codex') || a, T.outage.generator, t));
  line(4, 11, () => { o.gen = true; sfx.gen(); });
  line(5, 40, () => sceneSay(a, pick(T.outage.back), t));
  if (s2 > 41) { outage = null; outageNext = t + (FAST ? 200 : rand(7200, 14400)); }
}

sceneRegistry.add({ name: 'outage', active: () => !!outage, step: (_dt, t) => outageStep(t) });
