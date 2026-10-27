// Состояние панели на обоях: кто в офисе и чем занят, подсказка, сводка дня, восход и закат, кнопки.
// Панель опрашивает его 4 раза в секунду; нажатия обрабатываются здесь же (сцене — через шину событий).
import { KIND, actLabel, activity, agents, limitFor } from '@/entities/agent';
import { SEASONS, WEATHERS, env, localHM, localNow, pickSeason, pickWeather, sunTimes } from '@/entities/environment';
import { bus, callQuiet, config, gameQuiet, now, presence, server } from '@/entities/world';
import { sleepTime } from '@/features/agent-life';
import { focusAgent } from '@/features/focus-agent';
import { demo, fmtTemp, setDemo } from '@/features/office-data';
import { bossHere } from '@/features/scene-ermii';
import { pizzaStatus } from '@/features/scene-pizza';
import { audio } from '@/shared/audio';
import { api, isApp } from '@/shared/api/tauri';
import { APP_VERSION } from '@/shared/config/version';
import { DEMO, SHOW_HUD } from '@/shared/lib/flags';
import { fmtBig, plural } from '@/shared/lib/format';
import { fill } from '@/shared/i18n';
import ENV from '@/shared/i18n/ru/environment.json';
import P from '@/shared/i18n/ru/panel.json';
import type { HudActions, HudButton, HudRow, HudState } from './types';

const pl = (n: number, f: string[]) => plural(n, f[0], f[1], f[2]);

function statusColor(act: string, t: number) {
  if (act === 'work') return '#7fe0b4';
  if (act === 'wait') return ((t * 2) | 0) % 2 ? '#ffcf5c' : '#c9a23f';
  if (act === 'coffee' || act === 'tea' || act === 'cafe') return '#ff9ab8';
  if (act === 'ride') return '#ffc83a';
  if (act === 'pizza') return '#ff8a6b';
  return '#b9a8ff';
}

export function getHud(): HudState {
  const t = now(), k = localNow();
  const list = [...agents.values()].filter(a => !a.leaving);
  const sub = server.online ? fill(P.inOffice, { n: list.length }) : demo.on ? P.demoNoServer : P.noServer;
  const hint = !server.online && !DEMO ? P.hints.needServer : presence.typhoon ? P.hints.typhoon : bossHere() ? P.hints.boss
    : gameQuiet() ? P.hints.game : callQuiet() ? P.hints.call : sleepTime() ? P.hints.sleep : env.dayOff ? P.hints.dayOff : '';
  const d = server.dayStats;
  const stats = d ? [
    fill(P.statsDay, { files: pl(d.files, P.files), commands: pl(d.commands, P.commands) }),
    fill(P.statsWork, { commits: pl(d.commits, P.commits), tokens: fmtBig(d.tokens) }),
  ] : [];
  const sun = sunTimes();
  const rows: HudRow[] = list.map(a => {
    const act = activity(a, t), kd = KIND[a.kind] ?? KIND.claude;
    let status = limitFor(a) === 'limited' && act !== 'work' ? P.limitWait : actLabel(a, act) + (act === 'wait' && a.detail ? ' · ' + a.detail : '');
    if (a.subsWant) status += ' · ' + pl(a.subsWant, P.interns);
    return { id: a.id, kind: a.kind, name: a.name, status, color: statusColor(act, t), waiting: act === 'wait', head: kd.head, body: kd.body, eye: kd.eye };
  });
  const r = env.realW, coming = pizzaStatus() === 'coming';
  const buttons: HudButton[] = [
    { key: 'season', icon: env.season, text: fill(P.season, { name: ENV.seasons[env.season] }) + (env.seasonPick === 'auto' ? P.auto : '') },
    { key: 'weather', icon: env.weather, text: fill(P.weather, { name: ENV.weathers[env.weather] })
      + (env.weatherPick === 'real' ? (r && r.temp != null ? ' · ' + fmtTemp(r.temp) : ' · …') : env.weatherPick === 'auto' ? P.auto : '') },
    { key: 'sound', icon: audio.on ? 'soundOn' : 'soundOff', text: audio.on ? fill(P.soundOn, { v: Math.round(audio.volume * 100) }) : P.soundOff },
    { key: 'pizza', icon: 'pizza', half: true, text: coming ? P.pizzaComing : P.pizza, short: coming ? P.pizzaComingShort : P.pizzaShort },
    { key: 'demo', icon: demo.on ? 'demoOn' : 'demoOff', half: true, compact: true, on: demo.on, text: P.demo },
  ];
  return {
    side: config.panelSide, big: config.panelBig, oled: config.oled, full: SHOW_HUD,
    title: P.head, clock: `${String(k.h).padStart(2, '0')}:${String(k.m).padStart(2, '0')}`, tick: !!(k.s % 2),
    online: server.online, empty: server.online ? P.nobody : sub, rows, hint, stats,
    sun: fill(P.sun, { rise: localHM(sun.rise), set: localHM(sun.set), version: APP_VERSION }),
    buttons,
  };
}

/** Сезон, погода и звук, выбранные кнопками на обоях, сохраняются в настройках приложения. */
const saveChoice = () => { if (isApp()) void api.setSettings({ season: env.seasonPick, weather: env.weatherPick, sound: audio.on }).catch(() => {}); };

export const hudActions: HudActions = {
  button(key) {
    if (key === 'season') { pickSeason(SEASONS[(SEASONS.indexOf(env.seasonPick) + 1) % SEASONS.length]); bus.emit('refresh', null); saveChoice(); }
    else if (key === 'weather') { pickWeather(WEATHERS[(WEATHERS.indexOf(env.weatherPick) + 1) % WEATHERS.length]); bus.emit('refresh', null); saveChoice(); }
    else if (key === 'sound') { audio.setOn(!audio.on); saveChoice(); }
    else if (key === 'pizza') bus.emit('order-pizza', null);
    else if (key === 'demo') { setDemo(!demo.on); bus.emit('poll-now', null); }
  },
  row(id) { const a = agents.get(id); if (a) void focusAgent(a); },
};
