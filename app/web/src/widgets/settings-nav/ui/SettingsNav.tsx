// Левая колонка окна настроек: логотип с версией, вкладки, выход из программы.
import { useEffect, useState } from 'react';
import { api } from '@/shared/api/tauri';
import { fill } from '@/shared/i18n';
import T from '@/shared/i18n/ru/settings.json';
import s from './SettingsNav.module.scss';

export type TabId = keyof typeof T.nav & ('screen' | 'office' | 'agents' | 'day' | 'modes' | 'ermii' | 'stats' | 'server');
export const TABS: TabId[] = ['screen', 'office', 'agents', 'day', 'modes', 'ermii', 'stats', 'server'];

export function SettingsNav({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  const [version, setVersion] = useState('');
  useEffect(() => { api.appInfo().then(i => setVersion(i.version)).catch(() => {}); }, []);
  return (
    <aside className={s.nav}>
      <div className={s.logo}>
        <b className="px">{T.logo.name}</b>
        <i className="px">{T.logo.brand}</i>
        <small>{version ? fill(T.logo.version, { v: version }) : T.logo.sub}</small>
      </div>
      {TABS.map(id => (
        <button key={id} type="button" className={s.tab} aria-selected={tab === id} onClick={() => onTab(id)}>
          <span className={s.dot} />{T.nav[id]}
        </button>
      ))}
      <div className={s.grow} />
      <button type="button" className={s.quit} onClick={() => void api.quit()}>{T.nav.quit}</button>
    </aside>
  );
}
