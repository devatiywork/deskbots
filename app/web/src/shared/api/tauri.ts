// Связь страниц с приложением: команды (invoke) и события (listen/emit) Tauri.
// Вне приложения (в браузере, для проверки) команд нет: isApp() == false, вызовы отклоняются.
import { invoke } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { AppInfo, MonitorsInfo, OfficeState, ScreenInfo, Settings } from './types';

export const isApp = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const api = {
  getSettings: () => invoke<Settings>('get_settings'),
  setSettings: (patch: Partial<Settings>) => invoke<Settings>('set_settings', { patch }),
  monitors: () => invoke<MonitorsInfo>('monitors'),
  screen: () => invoke<ScreenInfo>('screen'),
  state: () => invoke<OfficeState>('state'),
  focus: (id: string) => invoke<{ result: string }>('focus', { id }),
  appInfo: () => invoke<AppInfo>('app_info'),
  installHooks: () => invoke<string[]>('install_hooks'),
  removeHooks: () => invoke<string[]>('remove_hooks'),
  quit: () => invoke<void>('quit'),
};

// события приложения: settings — настройки поменялись, screen — сменился монитор со звуком,
// desk — рабочий стол закрыли окнами или открыли, visit — позвать руководство Grand Ermii
export interface AppEvents {
  settings: Settings;
  screen: null;
  desk: boolean;
  visit: null;
}

export function on<K extends keyof AppEvents>(name: K, fn: (payload: AppEvents[K]) => void): () => void {
  if (!isApp()) return () => {};
  let off: UnlistenFn | null = null, gone = false;
  listen<AppEvents[K]>(name, e => fn(e.payload)).then(u => { if (gone) u(); else off = u; });
  return () => { gone = true; off?.(); };
}

export const send = <K extends keyof AppEvents>(name: K, payload?: AppEvents[K]) => (isApp() ? emit(name, payload) : Promise.resolve());
