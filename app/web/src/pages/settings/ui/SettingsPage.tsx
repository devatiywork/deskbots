// Окно настроек: слева меню, справа открытая вкладка. Вкладка со статистикой и сервером
// опрашивает приложение, только пока открыта.
import { useState } from 'react';
import { SettingsNav, type TabId } from '@/widgets/settings-nav';
import {
  AgentsSection, DaySection, ErmiiSection, ModesSection, OfficeSection, ScreenSection, ServerSection, StatsSection,
} from '@/widgets/settings-sections';
import s from './SettingsPage.module.scss';

const SECTIONS: Record<TabId, () => JSX.Element> = {
  screen: ScreenSection, office: OfficeSection, agents: AgentsSection, day: DaySection,
  modes: ModesSection, ermii: ErmiiSection, stats: StatsSection, server: ServerSection,
};

export function SettingsPage() {
  const [tab, setTab] = useState<TabId>('screen');
  const Current = SECTIONS[tab];
  return (
    <div className={s.page}>
      <SettingsNav tab={tab} onTab={setTab} />
      <main className={s.main}><Current /></main>
    </div>
  );
}
