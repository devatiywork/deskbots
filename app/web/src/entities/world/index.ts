// Мир сцены: планировка офиса, настройки сцены, время и очередь, шина событий, сценки, данные сервера.
// Остальные сущности сцены (агент, человек, машина, кот) опираются на него.
export * from './model/layout';
export { now, later, queueTick, bus, sceneRegistry, sceneOn, presence, type Scene, type SceneEvents } from './model/runtime';
export { config, SIGN_DEFAULT } from './model/config';
export { server, modes, gameQuiet, callQuiet, soundAllowed, pcHot } from './model/server';
export { view, screen, FONT_UI, fontPx } from './model/view';
export { crowd, speech, type Speaker, type Speech } from './model/crowd';
