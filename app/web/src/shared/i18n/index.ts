// Все тексты интерфейса и реплики лежат в JSON (shared/i18n/ru). Здесь — подстановка параметров.
// fill('Привет, {name}!', { name: 'Андрей' }) -> 'Привет, Андрей!'

export const fill = (s: string, params: Record<string, string | number> = {}): string =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));

export const pick = <T,>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];
