// Точка входа обоев. Без StrictMode: движок сцены запускается один раз на страницу.
import { createRoot } from 'react-dom/client';
import { WallpaperPage } from '@/pages/wallpaper';
import '../styles/global.scss';
import '../styles/wallpaper.scss';

createRoot(document.getElementById('root')!).render(<WallpaperPage />);
