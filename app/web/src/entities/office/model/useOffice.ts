// Состояние офиса от встроенного сервера (агенты, сводка дня, неделя, лимиты, ПК, кубки)
// и сведения о приложении (сервер, хуки, папка данных). Окно настроек опрашивает их раз в 3 секунды.
import { useEffect, useState } from 'react';
import { api } from '@/shared/api/tauri';
import type { AppInfo, OfficeState } from '@/shared/api/types';

function usePoll<T>(load: () => Promise<T>, enabled: boolean, ms = 3000): [T | null, () => void] {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const run = () => load().then(d => alive && setData(d)).catch(() => alive && setData(null));
    run();
    const id = setInterval(run, ms);
    return () => { alive = false; clearInterval(id); };
  }, [enabled, tick]);   // load — постоянная функция api, в зависимости не нужна
  return [data, () => setTick(n => n + 1)];
}

export const useOfficeState = (enabled: boolean) => usePoll<OfficeState>(api.state, enabled)[0];
export const useAppInfo = (enabled: boolean) => usePoll<AppInfo>(api.appInfo, enabled);
