// Настройки приложения → сцена: что показывать, распорядок, масштаб, вывеска, Grand Ermii, сезон, погода, звук, пауза.
import { pickSeason, pickWeather, place } from '@/entities/environment';
import { bus, config, now } from '@/entities/world';
import { resetRealWeather } from '@/features/office-data';
import { signChanged } from '@/features/scene-sign';
import { audio } from '@/shared/audio';
import type { Settings } from '@/shared/api/types';
import { renderBg } from '../lib';
import { refreshScene, setPaused } from './engine';
import { resize } from './output';

let signShown = false;

export function applySettings(s: Settings) {
  audio.setVolume(s.volume / 100);
  // место для восхода, заката и реальной погоды: фаза дня пересчитается сама в течение 5 секунд
  if (s.latitude !== place.lat || s.longitude !== place.lon) { place.lat = s.latitude; place.lon = s.longitude; resetRealWeather(); }
  config.show = { claude: s.showclaude, codex: s.showcodex, gpt: s.showgpt, ollama: s.showollama, other: s.showother };
  config.panelSide = s.panel; config.panelBig = s.panelsize === 'big';
  config.afkMin = s.afk; config.lunchOn = s.lunchon; config.lunchH = s.lunch; config.endH = s.endday;
  config.sleepOn = s.sleepon; config.sleepH = s.sleephour;
  config.gameQuiet = s.gamequiet; config.callMute = s.callmute;
  if (config.scaleCrisp !== (s.scale === 'crisp')) { config.scaleCrisp = s.scale === 'crisp'; resize(); }
  config.oled = s.oled;
  audio.apply();
  // новая надпись на вывеске: при запуске просто рисуем, а сменили при работающем офисе — агенты замечают
  const sign = [s.sign1, s.sign2].map(v => String(v ?? '').toUpperCase().slice(0, 24));
  if (sign.join('\n') !== config.sign.join('\n')) {
    config.sign = sign; renderBg();
    if (signShown) signChanged(now());
  }
  signShown = true;
  // Grand Ermii: режим, сколько раз в день, имена
  config.ermii = s.ermii; config.visits = Math.max(1, Math.min(4, s.visits));
  config.people = [{ look: 'me', name: s.p1name }, { look: 'dev', name: s.p2name }, { look: 'boss', name: s.p3name }];
  bus.emit('config', null);
  // сезон, погода, звук: кнопки на обоях и окно настроек меняют одно и то же
  const seasonNew = pickSeason(s.season), weatherNew = pickWeather(s.weather);
  if (seasonNew || weatherNew) refreshScene();
  if (s.sound !== audio.on) audio.setOn(s.sound);
  setPaused(s.paused);
}
