// Точка входа окна настроек.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SettingsProvider } from '@/entities/settings';
import { SettingsPage } from '@/pages/settings';
import '../styles/global.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <SettingsPage />
    </SettingsProvider>
  </StrictMode>,
);
