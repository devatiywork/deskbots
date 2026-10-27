// Реплики облачками. Облачки соседей не накладываются: ширина облачка оценивается в клетках сцены
// (длинные реплики идут в две строки). Важная реплика ждёт, пока сосед договорит; реплика сценки перебивает.
import { sfx } from '@/shared/audio';
import { FAST } from '@/shared/lib/flags';
import { rand } from '@/shared/lib/random';
import { FONT_UI, bus, crowd, fontPx, later, now, sceneOn, speech, view, type Speaker } from '@/entities/world';
import { agents, avail, type Agent } from './agent';

/** больше двух облачков разом агенты не говорят (если реплика не важная) */
const MAX_BUBBLES = 2;

const measC = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d')! : null;
export function bubbleW(s: string): number {
  if (!measC) return s.length;
  measC.font = `${fontPx(view.ws * 0.4)}px ${FONT_UI}`;
  let w = measC.measureText(s).width;
  if (w > measC.measureText('x'.repeat(26)).width) w *= 0.56;
  return w / view.ws + 4;
}

/** Кто рядом уже говорит так, что облачка налезут. */
export function clash(a: Speaker, s: string, t: number, skip: Speaker[] = []): Speaker | null {
  const wa = bubbleW(s), ya = a.labelY ?? a.y - 20;
  for (const x of crowd.all()) {
    if (x === a || skip.includes(x) || !x.say || x.say.until < t || x.arriving || x.hidden) continue;
    if (Math.abs(ya - (x.labelY ?? x.y - 20)) < 12 && Math.abs(a.x - x.x) < (wa + bubbleW(x.say.text)) / 2 + 1) return x;
  }
  return null;
}

/** Агент говорит. force — важная реплика (ответ в диалоге, сценка): не пропускается из-за соседей. */
export function say(a: Agent, s: string, t: number, force = false, tries = 0) {
  if (a.brk?.brief && speech.briefTalking && !speech.cafeLine) return;                // на брифинге говорят только по очереди
  if (!speech.talkWho?.includes(a)) {
    const c = clash(a, s, t);
    if (c && !force) { a.nextSay = t + rand(3, 6); return; }                         // сосед ещё говорит: реплика подождёт
    if (c && (speech.cafeLine || sceneOn() || speech.briefTalking)) c.say = null;     // сценка важнее: чужое облачко исчезает
    else if (c && tries < 4) {                                                       // важная реплика дождётся, пока сосед договорит
      later(c.say!.until + 0.3, () => { if (agents.has(a.id) && !a.leaving) say(a, s, now(), true, tries + 1); });
      return;
    }
  }
  const c = a.brk?.chat;
  // посреди разговора за столиком посторонние реплики не вклиниваются
  if (c && !speech.cafeLine && c.i < c.lines.length && a.brk?.cafe?.brk?.chat === c && c.i > 0) return;
  const busy = [...agents.values()].filter(x => x !== a && x.say && x.say.until > t).length;
  if (!force && busy >= MAX_BUBBLES) return;
  a.say = { text: s, until: t + 4.8, at: t };
  a.nextSay = t + (FAST ? rand(5, 9) : rand(25, 60));
  if (!a.arriving) sfx.blip(a.kind);
  bus.emit('said', { who: a, text: s, t });
}

/** Реплика участника сценки: важнее болтовни, очереди не ждёт. */
export function sceneSay(a: Agent | null | undefined, text: string, t: number) {
  if (a && avail(a)) { a.say = null; say(a, text, t, true); a.nextSay = t + 12; }
}
