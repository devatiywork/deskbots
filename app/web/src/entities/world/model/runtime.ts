// Общая механика сцены: часы, отложенные действия, шина событий и реестр сценок.
import type { Pt } from './layout';

/** Время сцены в секундах (performance.now() / 1000). */
export const now = () => performance.now() / 1000;

// отложенные действия: ответ звучит после того, как предыдущая реплика дочиталась
const queue: { at: number; fn: () => void }[] = [];
export const later = (at: number, fn: () => void) => { queue.push({ at, fn }); };
export function queueTick(t: number) {
  for (let i = queue.length - 1; i >= 0; i--) if (t >= queue[i].at) queue.splice(i, 1)[0].fn();
}

/**
 * События сцены: связь фич друг с другом без прямых импортов.
 * hook-fx — событие от хука (тест, push…), trophy — новый кубок, sign — новая надпись на вывеске,
 * refresh — перерисовать фон, reveal — офис снова виден.
 */
export interface SceneEvents {
  /** агент что-то сказал (на особые фразы отвечают другие: «Холодно!» — GPT несёт чай) */
  said: { who: object; text: string; t: number };
  /** агент вышел из своей машины у входа (здороваются, кот встречает) */
  'agent-arrived': { agent: object; t: number };
  'hook-fx': { type: string; agentId?: string };
  trophy: { id: string };
  sign: { lines: string[] };
  refresh: null;
  reveal: null;
  'order-pizza': null;
  /** опросить сервер сейчас, не дожидаясь двух секунд (переключили демо) */
  'poll-now': null;
  /** оборвать диалог пары, в которой есть who (сценка позвала его: заказ пиццы) */
  'talk-stop': { who: object };
  /** настройки сцены (config) поменялись: сценки перечитывают своё (визит — сколько раз в день) */
  config: null;
  /** салют из конфетти в точке (клетки сцены), n — сколько бумажек; рисует hook-fx */
  confetti: { x: number; y: number; n: number };
}
const handlers = new Map<string, ((p: never) => void)[]>();
export const bus = {
  on<K extends keyof SceneEvents>(k: K, fn: (p: SceneEvents[K]) => void) {
    if (!handlers.has(k)) handlers.set(k, []);
    handlers.get(k)!.push(fn as (p: never) => void);
  },
  emit<K extends keyof SceneEvents>(k: K, p: SceneEvents[K]) {
    for (const fn of handlers.get(k) || []) (fn as (p: SceneEvents[K]) => void)(p);
  },
};

/**
 * Сценка: пицца, инспекция, визит руководства… Пока идёт хоть одна «большая» сценка, другие не начинаются,
 * а реплики сценки важнее болтовни.
 */
export interface Scene {
  /** имя для проверок: gull, pizza, inspect, outage, tiger, visit, typhoon… */
  name: string;
  /** сценка сейчас идёт */
  active?: () => boolean;
  /** большая сценка: пока идёт, другие не начинаются (по умолчанию да; у тайфуна — нет) */
  blocks?: boolean;
  step?: (dt: number, t: number) => void;
}
const scenes: Scene[] = [];
export const sceneRegistry = {
  add(s: Scene) { scenes.push(s); },
  step(dt: number, t: number) { for (const s of scenes) s.step?.(dt, t); },
  anyActive: () => scenes.some(s => s.blocks !== false && s.active?.()),
  isActive: (name: string) => !!scenes.find(s => s.name === name)?.active?.(),
};
export const sceneOn = () => sceneRegistry.anyActive();

/**
 * Что сейчас в офисе, о чём должны знать другие фичи: руководство Grand Ermii (агенты не отдыхают),
 * пицца на кухонном столе (за столиком говорят о пицце), тайфун (реплики про ветер), пылесос и кот на нём.
 */
export const presence = {
  boss: false, pizzaOnTable: false, typhoon: false,
  /** робот-пылесос в пути (null — стоит на базе): кот, если сидит на нём, едет вместе */
  vacuum: null as Pt | null,
  /** кот сидит на пылесосе: его рисует пылесос, сам кот не рисуется */
  catOnVacuum: false,
};
