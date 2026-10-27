// Числа и время для подписей: 1.2B, 381M, 14:05, «5 коммитов».

export const fmtBig = (n: number): string =>
  n >= 1e9 ? (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M'
  : n >= 1e4 ? Math.round(n / 1e3) + 'K'
  : String(n);

export const hm = (ms: number): string => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** «1 файл», «2 файла», «5 файлов» */
export const plural = (n: number, one: string, few: string, many: string): string => {
  const a = n % 10, b = n % 100;
  return `${n} ${a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many}`;
};
