// Состояние визита Grand Ermii и общие помощники: кто из руководства в офисе, как его зовут, его реплика.
import { fill } from '@/shared/i18n';
import { FAST, has } from '@/shared/lib/flags';
import { config, now } from '@/entities/world';
import { npcSay, type Person } from '@/entities/person';

type Look = 'me' | 'dev' | 'boss';
/** come — лимузин едет, out — выходят, tour — ходят по офису, gather — собираются к выходу, board — садятся */
export type VisitState = 'come' | 'out' | 'tour' | 'gather' | 'board';

export interface Visit {
  state: VisitState;
  /** когда началось текущее состояние */
  at: number;
  /** кто уже вышел из лимузина */
  people: Person[];
  /** кто приехал (руководство с непустыми именами) */
  crew: { look: Look; name: string }[];
  /** начальник уже звонил по телефону */
  called: boolean;
  /** начальник уже выступал перед всеми */
  spoke: boolean;
  tourAt: number;
  /** когда последний раз открылась дверь лимузина */
  doorAt: number;
  /** режим выключили посреди визита: уезжают сразу */
  quick: boolean;
  /** начальник уже попрощался */
  bye: boolean;
}

/** visit — идущий визит; want — позвали сейчас (кнопка, #visit); next — когда приехать по плану */
export const ermii = { visit: null as Visit | null, want: has('visit'), next: 0 };

/** сколько ходят по офису, секунд */
export const visitLen = () => (FAST ? 120 : 600);
export const visitPeople = () => config.people.filter(p => p.name.trim());
/** Руководство в офисе: агенты не отдыхают. */
export const bossHere = () => !!ermii.visit && ermii.visit.state !== 'come';
export const nameOf = (look: Look) => config.people.find(p => p.look === look)?.name.trim() || '';
export const who = (look: string): Person | null =>
  ermii.visit?.people.find(o => o.look === look && !o.hidden && !o.gone) || null;
/** Идёт обход, а не сборы к выходу: отложенные реплики обхода звучат только тогда. */
export const touring = () => { const s = ermii.visit?.state; return s === 'out' || s === 'tour'; };

/** Имя для обращения: «Я» в обращении звучит странно — тогда без имени. */
export const meName = () => (/^я$/i.test(nameOf('me')) ? '' : nameOf('me'));

/** Подставляет имена; пустое имя в обращении уходит вместе с запятой: «{me}, когда релиз?» → «Когда релиз?». */
export function named(s: string, names: Record<string, string>) {
  const r = fill(
    s.replace(/^\{(\w+)\},\s*/, (m, k: string) => (names[k] ? m : '')).replace(/,\s*\{(\w+)\}(?=[,?!.…]|$)/g, (m, k: string) => (names[k] ? m : '')),
    names,
  );
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/** Реплика человека из руководства, если он сейчас в офисе. */
export function visitSay(look: string, text: string, at?: number) {
  const o = who(look);
  if (o && o.inside) npcSay(o, text, at ?? now());
  return !!o;
}
