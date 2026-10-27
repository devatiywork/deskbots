// Обои: сцена офиса на весь экран и панель поверх неё. В приложении — связь с ним (настройки, мышь, звук).
import { useEffect } from 'react';
import { OfficePanel } from '@/widgets/office-panel';
import { OfficeScene } from '@/widgets/office-scene';
import { bindApp, exposeDebug } from '../model/bridge';

export function WallpaperPage() {
  useEffect(() => { bindApp(); exposeDebug(); }, []);
  return (
    <>
      <OfficeScene />
      <OfficePanel />
    </>
  );
}
