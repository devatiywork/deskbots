// Отладочные флаги в адресе страницы обоев: #demo-visit-fast и т. п. (список — в ARCHITECTURE.md).

export const HASH = typeof location !== 'undefined' ? location.hash : '';
/** Флаг целиком, между # или дефисами: flag('ny') не сработает на «#sunny». */
export const flag = (f: string) => new RegExp(`(?:#|-)${f}(?=-|$)`).test(HASH);
/** Подстрока в адресе — так проверялись старые флаги (demo, fast, visit…). */
export const has = (s: string) => HASH.includes(s);

export const DEMO = has('demo');            // ненастоящие агенты, без сервера
export const FAST = has('fast');            // частые перерывы, реплики, смена погоды
export const SHOW_HUD = !has('nohud');      // панель на обоях
