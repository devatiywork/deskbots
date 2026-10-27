// Две страницы приложения: обои с офисом (wallpaper) и окно настроек (settings).
// Tauri берёт готовую сборку из dist: окна открывают wallpaper/index.html и settings/index.html.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // версия в панели на обоях: «v4.0»
  define: { __APP_VERSION__: JSON.stringify((process.env.npm_package_version || '0.0').split('.').slice(0, 2).join('.')) },
  base: './',
  resolve: { alias: { '@': at('./src') } },
  css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
  server: { port: 5173, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        wallpaper: at('./wallpaper/index.html'),
        settings: at('./settings/index.html'),
      },
    },
  },
});
