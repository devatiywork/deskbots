// Версия интерфейса для подписи в панели (подставляет Vite из package.json).
declare const __APP_VERSION__: string;
export const APP_VERSION = `v${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '4.0'}`;
