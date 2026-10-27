// Календарь: выходные и праздники РФ (с переносами на 2026–2027 годы), праздники Владивостока, фаза луны.
import { flag, HASH } from '@/shared/lib/flags';

export type Holiday = '' | 'ny' | 'tiger' | 'city' | 'feb23' | 'mar8' | 'smelt';

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// нерабочие дни, кроме суббот и воскресений, и рабочие субботы: постановления о переносе выходных на 2026 и 2027 годы
const OFF_DAYS = new Set([
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `2026-01-0${d}`), '2026-02-23', '2026-03-09', '2026-05-01', '2026-05-11', '2026-06-12', '2026-11-04', '2026-12-31',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(d => `2027-01-0${d}`), '2027-02-22', '2027-02-23', '2027-03-08', '2027-05-03', '2027-05-10', '2027-06-14', '2027-11-04', '2027-11-05', '2027-12-31',
]);
const WORK_DAYS = new Set(['2027-02-20']);
const FIXED_HOLIDAYS = ['02-23', '03-08', '05-01', '05-09', '06-12', '11-04'];

export function isDayOff(d = new Date()): boolean {
  if (flag('weekend')) return true;
  if (flag('nooff')) return false;
  const k = ymd(d), wd = d.getDay(), y = d.getFullYear();
  if (WORK_DAYS.has(k)) return false;
  if (OFF_DAYS.has(k) || wd === 0 || wd === 6) return true;
  if (y === 2026 || y === 2027) return false;
  // другие годы: праздники по Трудовому кодексу, праздник в выходной переносится на понедельник
  if (/^01-0[1-8]$/.test(k.slice(5)) || FIXED_HOLIDAYS.includes(k.slice(5))) return true;
  if (wd !== 1) return false;
  return [1, 2].some(back => { const x = new Date(d); x.setDate(d.getDate() - back); return FIXED_HOLIDAYS.includes(ymd(x).slice(5)); });
}

/** День тигра — последнее воскресенье сентября. */
const isTigerDay = (d: Date) => d.getMonth() === 8 && d.getDay() === 0 && d.getDate() > 23;

export function holidayNow(d = new Date()): Holiday {
  const m = d.getMonth() + 1, day = d.getDate();
  if (flag('ny') || (m === 12 && day >= 20) || (m === 1 && day <= 10)) return 'ny';
  if (flag('tiger') || isTigerDay(d)) return 'tiger';
  if (flag('city') || (m === 7 && day === 2)) return 'city';
  if (m === 2 && day === 23) return 'feb23';
  if (m === 3 && day === 8) return 'mar8';
  if (flag('smelt') || m === 4) return 'smelt';
  return '';
}

/** Фаза луны: 0 — новолуние, 0.5 — полнолуние (синодический месяц от новолуния 6 января 2000). */
export function moonAge(d = new Date()): number {
  const forced = HASH.match(/moon-(\d+)/);
  if (forced) return (+forced[1] % 100) / 100;
  return ((((d.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5 / 29.530588853) % 1) + 1) % 1;
}
