// Настройки приложения: одни на все окна. Загружаются при старте, меняются через save(),
// а если их поменяли в другом окне (кнопки на обоях, трей), приходит событие settings.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, on } from '@/shared/api/tauri';
import type { Settings } from '@/shared/api/types';

interface Ctx { settings: Settings | null; save: (patch: Partial<Settings>) => Promise<void> }
const SettingsContext = createContext<Ctx>({ settings: null, save: async () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    api.getSettings().then(setSettings).catch(e => console.error('настройки не загрузились', e));
    return on('settings', setSettings);
  }, []);
  const save = useCallback(async (patch: Partial<Settings>) => {
    try { setSettings(await api.setSettings(patch)); } catch (e) { console.error('настройки не сохранились', e); }
  }, []);
  return <SettingsContext.Provider value={{ settings, save }}>{children}</SettingsContext.Provider>;
}

export const useSettings = () => useContext(SettingsContext);

/** Одна настройка: значение и функция, которая её сохраняет. */
export function useSetting<K extends keyof Settings>(key: K): [Settings[K] | undefined, (v: Settings[K]) => void] {
  const { settings, save } = useSettings();
  return [settings?.[key], v => { void save({ [key]: v } as Partial<Settings>); }];
}
