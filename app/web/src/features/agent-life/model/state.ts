// Общее состояние жизни агентов: брифинг и чай (их проверяют перерывы, диалоги, «офис заметил»),
// и мелкие помощники для реплик.
import A from '@/shared/i18n/ru/agent.json';
import L from '@/shared/i18n/ru/lines.json';
import { callQuiet, sceneRegistry, type Place } from '@/entities/world';
import { GROUP, agents, type Agent } from '@/entities/agent';

/** Кого позвали на брифинг и на какое место; done — пришёл или пропускает. */
export interface BriefCall { a: Agent; spot: Place; done?: boolean }
/** Брифинг: сбор (gather), потом реплики по очереди (talk). */
export interface Brief {
  at: number; lead: Agent; team: Agent[]; called: BriefCall[];
  state: 'gather' | 'talk'; i: number; next: number; lines: [Agent, string][];
}
/** Чай от GPT для Клода: просит, отвечает, заваривает, несёт, благодарят. */
export interface Tea { c: Agent; g: Agent; state: 'ask' | 'reply' | 'brew' | 'carry' | 'thanks'; at: number; lemon: boolean }

export const life = { brief: null as Brief | null, tea: null as Tea | null };

/** Агент занят чаем: просит его или несёт. */
export const teaWith = (a: Agent) => !!life.tea && (life.tea.c === a || life.tea.g === a);

/** Объект из шины — агент в офисе (или null, если это гость или кот). */
export const asAgent = (o: object): Agent | null => {
  const a = agents.get((o as { id?: string }).id ?? '');
  return a === o ? a : null;
};

/** Как обращаются к агенту: «Клод», «GPT», «Лама». */
export const voc = (a: Agent) => (A.vocative as Record<string, string>)[GROUP[a.kind]];

const ACTS = L.acts as Record<string, string[]>;
/** Реплики к занятию (кофе, чай, графики…); ожидание и кофейня — свои; незнакомое занятие — как за столом. */
export const actLines = (act?: string): string[] => (act === 'wait' ? L.wait : act === 'cafe' ? L.cafe : ACTS[act ?? ''] || ACTS.desk);

/** Идёт тихая сценка (чайка, инспекция, свет отключили, тигр, звонок клиента, кофемашина, день рождения) или созвон: болтать нельзя. */
export const sceneQuiet = () => ['gull', 'inspect', 'outage', 'tiger', 'client', 'coffee', 'birthday'].some(n => sceneRegistry.isActive(n)) || callQuiet();
