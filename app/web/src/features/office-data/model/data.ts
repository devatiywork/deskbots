// Данные офиса: состояние от встроенного сервера (в приложении — команда state), демо-агенты для проверки
// и пустого офиса, реальная погода с Open-Meteo. Сцена опрашивает это раз в 2 секунды.
import { env, place } from '@/entities/environment';
import { GROUP } from '@/entities/agent';
import { server } from '@/entities/world';
import { api, isApp } from '@/shared/api/tauri';
import type { AgentState, OfficeFx, OfficeState } from '@/shared/api/types';
import { DEMO, flag, has } from '@/shared/lib/flags';
import { rng } from '@/shared/lib/random';
import { store } from '@/shared/lib/store';
import D from '@/shared/i18n/ru/demo.json';

/**
 * Что пришло за один опрос: агенты, события хуков, игра и созвон.
 * fixed — готовый список для проверки (#demo): его не фильтруют и демо-двойников к нему не добавляют.
 */
export interface Snapshot { agents: AgentState[]; fx: OfficeFx[]; game: boolean; mic: boolean; fixed?: boolean }

// демо: если человек сам не выбрал, включается только когда сервер не отвечает, чтобы офис не стоял пустым
let demoPref = store.get('office-demo');
export const demo = { on: false };
const demoAuto = () => { demo.on = demoPref === 'on' || (demoPref !== 'off' && !server.online); };
export function setDemo(on: boolean) { demoPref = on ? 'on' : 'off'; store.set('office-demo', demoPref); demoAuto(); }

// демо-двойники заполняют офис, пока настоящей программы той же команды нет; появилась настоящая — двойник уходит
const DEMO_TASKS = [['Edit', 'App.tsx'], ['Bash', 'npm test'], ['Read', 'README.md'], ['Grep', 'TODO'], ['WebSearch', 'pixel art'], ['думает', 'план'], ['Write', 'notes.md'], ['Edit', 'styles.css']];
/** Демо-двойники добавляются уже после фильтров (скрытые виды, ушедшие домой). */
export function withDemo(real: AgentState[], t: number): AgentState[] {
  if (!demo.on) return real;
  const have = new Set(real.map(x => GROUP[x.kind] || 'claude'));
  const bots = (D.bots as (AgentState & { hooks?: boolean })[]).filter(b => !have.has(GROUP[b.kind])).map((b, i) => {
    // раз в две минуты демо-агент меняет занятие: то работает, то отдыхает
    const r = rng((((t + i * 53) / 120) | 0) * 97 + i), working = r() < 0.6, [tool, detail] = DEMO_TASKS[(r() * DEMO_TASKS.length) | 0];
    return { ...b, status: working ? 'working' as const : 'idle' as const, tool: working && b.hooks ? tool : '', detail: working && b.hooks ? detail : b.detail || '' };
  });
  return [...real, ...bots];
}

// #demo: правдоподобные данные для проверки без сервера
let demoFx = false;
function demoData(t: number): Snapshot {
  const ms = Date.now();
  server.dayStats ||= { files: 42, commands: 318, commits: 12, tokens: 186e6 };
  server.pcStats = { cpu: flag('hot') ? 97 : Math.round(30 + 20 * Math.sin(t / 7)), mem: 61, gpu: { load: Math.round(55 + 30 * Math.sin(t / 5)), temp: flag('hot') ? 86 : 64 } };
  server.limits = {
    claude: flag('limit') ? { tokens: 0, reset: 0, pct: null, limited: ms + 5400e3 } : { tokens: 124e6, reset: ms + 8e6, pct: 64 },
    codex: { five: { pct: 42, reset: ms + 9e6 }, week: { pct: 18, reset: ms + 4 * 864e5 } },
  };
  const dow = new Date().getDay();
  server.weekData = [0.6, 0.9, 0.4, 1, 0.75, 0.2, 0.55].map((k, i) => ({ dow: (dow + 1 + i) % 7, tokens: Math.round(k * 9e8), commits: Math.round(k * 50) }));
  if (!server.trophies.length) server.trophies = flag('trophies') ? Object.keys(D.allTrophies) : ['tokens100m', 'commits50', 'night', 'team3'];
  const fx: OfficeFx[] = [];
  if (t > 25 && !demoFx) {
    demoFx = true;
    if (flag('push')) fx.push({ n: 1, type: 'push-ok', agent: 'd1' });
    if (flag('fail')) fx.push({ n: 2, type: 'test-fail', agent: 'd2' });
    if (flag('testok')) fx.push({ n: 3, type: 'test-ok', agent: 'd2' });
    if (flag('trophy')) { server.trophies = server.trophies.filter(x => x !== 'streak7'); fx.push({ n: 4, type: 'trophy', id: 'streak7' }); }
  }
  // #leave: Codex через 15 секунд уходит — проверить, как его забирает машина
  const list = (D.list as AgentState[]).map(a => (a.id === 'd1' && flag('interns') ? { ...a, subs: 3 } : a))
    .filter(x => !(has('leave') && x.id === 'd2' && performance.now() > 15000));
  return { agents: list, fx, game: flag('game'), mic: flag('call'), fixed: true };
}

/**
 * Один опрос: обновляет server.* и возвращает настоящих агентов и события. Без сервера — пустой список.
 * Фильтры (скрытые виды, ушедшие домой) и демо-двойников (withDemo) добавляет сцена после опроса.
 */
export async function poll(t: number): Promise<Snapshot> {
  void realWeather();
  if (DEMO) { server.online = true; demoAuto(); return demoData(t); }
  if (!isApp()) { server.online = false; demoAuto(); return { agents: [], fx: [], game: false, mic: false }; }
  try {
    const d: OfficeState = await api.state();
    if (!d || d.error) throw new Error(d?.error || 'office');
    server.online = true; demoAuto();
    server.userIdleMs = Number(d.idleMs ?? d.idle ?? 0) || 0;
    server.locked = !!d.locked;
    server.dayStats = d.stats || null;
    server.limits = d.limits || null; server.pcStats = d.pc || null; server.weekData = d.week || null;
    server.trophies = d.trophies || server.trophies;
    return { agents: d.agents || [], fx: d.fx || [], game: !!d.game || flag('game'), mic: !!d.mic || flag('call') };
  } catch {
    server.online = false; demoAuto();
    return { agents: [], fx: [], game: flag('game'), mic: flag('call') };
  }
}

// реальная погода: Open-Meteo по широте и долготе из настроек раз в 15 минут — единственный запрос обоев в интернет
let realNext = 0;
export const resetRealWeather = () => { realNext = 0; };
export const fmtTemp = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}°`;
async function realWeather() {
  if (env.weatherPick !== 'real' || Date.now() < realNext) return;
  realNext = Date.now() + 15 * 60e3;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat.toFixed(2)}&longitude=${place.lon.toFixed(2)}`
      + '&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh';
    const c = (await (await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })).json()).current;
    const code = +c.weather_code, wind = +c.wind_speed_10m, gusts = +c.wind_gusts_10m;
    const kind = code >= 95 ? 'storm' : (code >= 71 && code <= 77) || code === 85 || code === 86 ? 'snow'
      : (code >= 51 && code <= 67) || (code >= 80 && code <= 82) ? 'rain' : code === 45 || code === 48 ? 'fog' : wind >= 30 ? 'wind' : 'clear';
    env.realW = { kind, temp: +c.temperature_2m, typhoon: wind >= 55 || gusts >= 80, at: Date.now() };
  } catch { realNext = Date.now() + 3 * 60e3; }     // нет сети: попробуем через 3 минуты
}
