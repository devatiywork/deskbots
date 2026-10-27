// Окружение сцены: время суток, выходной или праздник, сезон, погода. Пересчитывается раз в 5 секунд,
// а сцена перерисовывает фон, когда что-то из этого меняется (refresh).
import { FAST, HASH } from '@/shared/lib/flags';
import { rand } from '@/shared/lib/random';
import { store } from '@/shared/lib/store';
import { holidayNow, isDayOff, type Holiday } from './calendar';
import { localNow, phaseNow, type Phase } from './clock';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SeasonPick = 'auto' | Season;
export type Weather = 'clear' | 'rain' | 'storm' | 'snow' | 'fog' | 'wind';
export type WeatherPick = 'real' | 'auto' | Weather;

export const SEASONS: SeasonPick[] = ['auto', 'spring', 'summer', 'autumn', 'winter'];
export const WEATHERS: WeatherPick[] = ['real', 'auto', 'clear', 'rain', 'storm', 'snow', 'fog', 'wind'];

// как часто бывает каждая погода в сезоне (для «Авто»)
const WEATHER_MIX: Record<Season, Partial<Record<Weather, number>>> = {
  winter: { snow: 5, clear: 2.5, fog: 1.5, wind: 1 },
  spring: { clear: 4, rain: 3, wind: 2, fog: 1 },
  summer: { clear: 4.5, rain: 3, storm: 1.5, wind: 1 },
  autumn: { wind: 3.5, rain: 3, fog: 2, clear: 1.5 },
};

/** Реальная погода с Open-Meteo: вид, температура, тайфун, когда получена. */
export interface RealWeather { kind: Weather; temp?: number; typhoon?: boolean; at: number }

const stored = <T extends string>(key: string, list: readonly T[], def: T): T => { const v = store.get(key) as T | null; return v && list.includes(v) ? v : def; };

export const env = {
  phase: phaseNow() as Phase,
  dayOff: isDayOff(),
  holiday: holidayNow() as Holiday,
  seasonPick: stored('office-season', SEASONS, 'auto'),
  season: 'autumn' as Season,
  realW: null as RealWeather | null,
  weatherPick: stored('office-weather', WEATHERS, 'real'),
  autoW: ((): { kind: Weather; season: Season; until: number } | null => { try { return JSON.parse(store.get('office-weather-auto') || 'null'); } catch { return null; } })(),
  weather: 'clear' as Weather,
  /** когда сменилась погода (секунды сцены): новая разгорается постепенно */
  weatherSince: 0,
};

export function seasonNow(): Season {
  const forced = HASH.match(/spring|summer|autumn|winter/);
  if (forced) return forced[0] as Season;
  if (env.seasonPick !== 'auto') return env.seasonPick;
  const m = localNow().mon;
  return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
}

export function weatherNow(): Weather {
  const forced = HASH.match(/(?:#|-)(clear|rain|storm|snow|fog|wind)(?=-|$)/);
  if (forced) return forced[1] as Weather;
  if (HASH.includes('typhoon')) return 'storm';
  // реальная погода, пока свежая (не старше 3 часов); без неё — как «Авто»
  const r = env.realW;
  if (env.weatherPick === 'real' && r && Date.now() - r.at < 3 * 3600e3) return r.typhoon ? 'storm' : r.kind;
  if (env.weatherPick !== 'auto' && env.weatherPick !== 'real') return env.weatherPick;
  const mix = WEATHER_MIX[env.season], a = env.autoW;
  if (!a || a.season !== env.season || Date.now() > a.until || !mix[a.kind]) {
    let r2 = Math.random() * Object.values(mix).reduce((s, v) => s + (v ?? 0), 0), kind: Weather = 'clear';
    for (const [k, v] of Object.entries(mix) as [Weather, number][]) if ((r2 -= v) < 0) { kind = k; break; }
    env.autoW = { kind, season: env.season, until: Date.now() + (FAST ? rand(25, 40) : rand(6, 15) * 60) * 1000 };
    store.set('office-weather-auto', JSON.stringify(env.autoW));
  }
  return env.autoW!.kind;
}

env.season = seasonNow();
env.weather = weatherNow();

export const isWet = () => env.weather === 'rain' || env.weather === 'storm';
export const isGrey = () => env.weather !== 'clear' && env.weather !== 'wind';

/** Выбор сезона и погоды (кнопками на обоях или в настройках); true — если поменялось. */
export function pickSeason(v: string): boolean {
  if (!SEASONS.includes(v as SeasonPick) || v === env.seasonPick) return false;
  env.seasonPick = v as SeasonPick; store.set('office-season', v); return true;
}
export function pickWeather(v: string): boolean {
  if (!WEATHERS.includes(v as WeatherPick) || v === env.weatherPick) return false;
  env.weatherPick = v as WeatherPick; store.set('office-weather', v); return true;
}

/** Пересчёт раз в 5 секунд: true — если сменилось время суток, сезон или погода и фон надо перерисовать. */
export function envTick(): boolean {
  env.dayOff = isDayOff(); env.holiday = holidayNow();
  return phaseNow() !== env.phase || seasonNow() !== env.season || weatherNow() !== env.weather;
}

/** Применить пересчитанное (перед перерисовкой фона). */
export function envApply(t: number) {
  env.season = seasonNow(); env.phase = phaseNow();
  const w = weatherNow();
  if (w !== env.weather) { env.weather = w; env.weatherSince = t; }
}
