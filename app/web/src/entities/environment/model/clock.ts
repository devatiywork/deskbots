// Время: системное (часовой пояс Windows); день, сумерки и ночь — по настоящему восходу и закату для места из настроек.
import { HASH } from '@/shared/lib/flags';

export type Phase = 'day' | 'dusk' | 'night';

/** Место для восхода и заката: по умолчанию Владивосток, меняется в настройках. */
export const place = { lat: 43.12, lon: 131.89 };

export function localNow() {
  const d = new Date();
  return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), mon: d.getMonth() + 1 };
}

export const utcMin = (d = new Date()) => d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
const wrap = (m: number) => ((m % 1440) + 1440) % 1440;

/** Восход и закат на сегодня (формулы NOAA) в минутах от полуночи UTC; на Дальнем Востоке восход бывает «вчера» (< 0). */
export function sunTimes(d = new Date()) {
  const lat = (place.lat * Math.PI) / 180, lon = place.lon;
  const N = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const gm = ((2 * Math.PI) / 365) * (N - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(gm) - 0.032077 * Math.sin(gm) - 0.014615 * Math.cos(2 * gm) - 0.040849 * Math.sin(2 * gm));
  const decl = 0.006918 - 0.399912 * Math.cos(gm) + 0.070257 * Math.sin(gm) - 0.006758 * Math.cos(2 * gm) + 0.000907 * Math.sin(2 * gm)
    - 0.002697 * Math.cos(3 * gm) + 0.00148 * Math.sin(3 * gm);
  const cosHa = Math.cos((90.833 * Math.PI) / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
  const ha = (Math.acos(Math.max(-1, Math.min(1, cosHa))) * 180) / Math.PI;   // полярный день или ночь: без NaN
  return { rise: 720 - 4 * (lon + ha) - eqt, set: 720 - 4 * (lon - ha) - eqt };
}

/** Минуты UTC в местное «ЧЧ:ММ». */
export function localHM(m: number) {
  const v = Math.round(wrap(m - new Date().getTimezoneOffset())) % 1440;
  return `${String((v / 60) | 0).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/**
 * Сумерки: от 40 минут до восхода до 30 после и от 30 минут до заката до 40 после.
 * Считаем от восхода по кругу суток, чтобы работало при любой долготе.
 */
export function phaseNow(): Phase {
  const forced = HASH.match(/night|dusk|day/);
  if (forced) return forced[0] as Phase;
  const { rise, set } = sunTimes(), t = wrap(utcMin() - rise), dayLen = wrap(set - rise);
  if (t < 30 || t >= 1440 - 40 || (t >= dayLen - 30 && t < dayLen + 40)) return 'dusk';
  return t >= 30 && t < dayLen - 30 ? 'day' : 'night';
}
