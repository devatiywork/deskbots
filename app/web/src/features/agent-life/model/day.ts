// Распорядок дня: отошёл от компьютера, обед, конец рабочего дня, выходной, пора спать.
// Фильтры списка от сервера: скрытые в настройках виды не приезжают, свободные уходят домой.
import { FAST, has } from '@/shared/lib/flags';
import { pick } from '@/shared/lib/random';
import type { AgentState } from '@/shared/api/types';
import L from '@/shared/i18n/ru/lines.json';
import { env, localNow } from '@/entities/environment';
import { bus, config, now, sceneOn, server } from '@/entities/world';
import { sceneCrew, sceneSay, say } from '@/entities/agent';
import { cafeWith } from './breaks';
import { asAgent } from './state';

/** почему свободные уходят домой: ты отошёл (afk), поздно (late), выходной (off) */
export type HomeWhy = '' | 'afk' | 'late' | 'off';
// backFromAfk — когда ты вернулся после отлучки; до первой отлучки «давно» (в старом коде был 0,
// и все, кто приезжал в первые полторы минуты после запуска, здоровались «С возвращением!»)
let why: HomeWhy = '', backFromAfk = -1e9, lunchDay = '', sleepNext = 60;
/** id -> { status, at }: как давно агент в нынешнем статусе */
const statusAt = new Map<string, { status: string; at: number }>();

export const homeWhy = () => why;

type ShowGroup = keyof typeof config.show;
const showGroup = (k: string): ShowGroup =>
  k === 'claude' || k === 'claude-app' ? 'claude' : k === 'codex' ? 'codex' : k === 'chatgpt' ? 'gpt' : k === 'ollama' ? 'ollama' : 'other';

/** Убрать виды, выключенные в настройках («Кого показывать»). */
export const showFilter = (list: AgentState[]) => list.filter(s => config.show[showGroup(s.kind)] !== false);

/** Пора спать: ты за компьютером после часа сна (до 5 утра). */
export const sleepTime = () =>
  config.sleepOn && (has('late') || (server.online && server.userIdleMs < 120e3 && (localNow().h >= config.sleepH || localNow().h < 5)));

/** Кто без дела, уходит домой: ты отошёл дольше config.afkMin минут или рабочий день кончился (до 6 утра). */
export function homeFilter(list: AgentState[]): AgentState[] {
  const t = now(), h = localNow().h;
  for (const s of list) { const p = statusAt.get(s.id); if (!p || p.status !== s.status) statusAt.set(s.id, { status: s.status, at: t }); }
  for (const id of statusAt.keys()) if (!list.some(s => s.id === id)) statusAt.delete(id);
  const away = has('afk') || (config.afkMin > 0 && server.userIdleMs > config.afkMin * 60e3);
  const night = has('late') || h >= config.endH || h < 6, late = night || env.dayOff;   // в выходной свободные тоже расходятся
  if (why === 'afk' && !away) backFromAfk = t;
  why = away ? 'afk' : late ? (night ? 'late' : 'off') : '';
  if (!why) return list;
  return list.filter(s => !(s.status === 'idle' && t - statusAt.get(s.id)!.at > (away ? 60 : 600)));
}

/** Обед (пицца или кофейня) и напоминание «пора спать» раз в 15 минут. */
export function dayTick(t: number) {
  const k = localNow(), today = new Date().toDateString();
  if (config.lunchOn && k.h === config.lunchH && k.m < 10 && lunchDay !== today && !sceneOn()) {
    const c = sceneCrew();
    if (c.length) {
      lunchDay = today;
      sceneSay(c[0], pick(L.lunch), t);
      if (Math.random() < 0.6) bus.emit('order-pizza', null); else cafeWith(c[0], t);
    }
  }
  if (sleepTime() && t > sleepNext) {
    sleepNext = t + (FAST ? 40 : 900);
    const c = sceneCrew();
    if (c.length) sceneSay(pick(c), pick(L.sleepTime), t);
  }
}

// вернулся после того, как ты отходил: «С возвращением!»
bus.on('agent-arrived', ({ agent, t }) => {
  const a = asAgent(agent);
  if (a && t - backFromAfk < 90) say(a, pick(L.welcome), t, true);
});
