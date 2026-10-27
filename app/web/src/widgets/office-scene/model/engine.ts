// Движок сцены: цикл кадров (не чаще 30 в секунду, в тихом режиме игры — 10), шаги симуляции в порядке старого кода,
// отрисовка по глубине и вывод на экран, опрос данных раз в 2 секунды, пересчёт окружения раз в 5 секунд.
// Порядок импорта сценок важен: в таком порядке они шагают каждый кадр.
import '@/features/scene-gulls';
import '@/features/scene-pizza';
import '@/features/scene-inspection';
import '@/features/scene-outage';
import '@/features/scene-typhoon';
import '@/features/scene-ermii';
import '@/features/scene-tiger';
import '@/features/scene-icebreaker';
import '@/features/scene-fireworks';
import '@/features/scene-vacuum';
import '@/features/scene-client-call';
import '@/features/scene-coffee-broken';
import '@/features/scene-birthday';
import { agents, captions, drawBot, drawIntern, drawLabel } from '@/entities/agent';
import { carStep, cars, drawCar } from '@/entities/car';
import { envApply, envTick } from '@/entities/environment';
import { drawNpc, drawNpcLabel, npcTick, npcs } from '@/entities/person';
import { bus, gameQuiet, modes, now, presence, sceneRegistry, screen, soundAllowed, view } from '@/entities/world';
import { agentsStep, cafeSince, homeFilter, onReveal, showFilter, syncAgents } from '@/features/agent-life';
import { confettiStep, drawConfetti, fxIntake, setModes, trophyGlow, trophyTick } from '@/features/hook-fx';
import { catDepthY, catStep, drawCat, drawHearts, drawTreat } from '@/features/office-cat';
import { poll, withDemo } from '@/features/office-data';
import { drawFireworks } from '@/features/scene-fireworks';
import { drawGulls } from '@/features/scene-gulls';
import { drawIcebreaker } from '@/features/scene-icebreaker';
import { drawOutage, generatorOn, outageOn, powerOff } from '@/features/scene-outage';
import { drawPizza, pizzaUntil } from '@/features/scene-pizza';
import { cakeDepthY, drawCake } from '@/features/scene-birthday';
import { drawCoffeeFx } from '@/features/scene-coffee-broken';
import { drawSignFx } from '@/features/scene-sign';
import { drawTiger, tigerDepthY } from '@/features/scene-tiger';
import { DOCK_DEPTH_Y, drawDock, drawVacuum, vacuumDepthY } from '@/features/scene-vacuum';
import { audio } from '@/shared/audio';
import { H, W, setTarget } from '@/shared/lib/pixel/canvas';
import { b, bgc, g, scr } from '@/shared/lib/pixel/layers';
import {
  billboardText, buildTrees, clearWeather, drawBacklight, drawBoard, drawFireflies, drawFlash, drawFog, drawGarland, drawLampLight,
  drawRoomLight, drawShelf, drawStreaks, drawStreetLights, drawTip, drawTrees, drawWallLive, drawWeather, furnitureItems, lampStep,
  orbit, renderBg, setFeatureState, weatherStep, windNow, windStep, type DepthItem,
} from '../lib';
import { ambienceStep } from './ambience';
import { bubbles, resize } from './output';

/** Перерисовать неподвижный фон: время суток, сезон, погода или вывеска поменялись. */
export function refreshScene(t = now()) {
  envApply(t); clearWeather(); renderBg(); buildTrees();
}

function frame(t: number, dt: number) {
  windNow(t);
  agentsStep(dt, t); carStep(dt, t); sceneRegistry.step(dt, t); npcTick(t);
  lampStep(dt, t); windStep(dt); weatherStep(dt, t); catStep(dt, t); ambienceStep(dt, t, generatorOn());
  confettiStep(dt); trophyTick(t);
  setFeatureState({ typhoon: presence.typhoon, outage: outageOn(), powerOff: powerOff() });

  setTarget(g);
  g.drawImage(bgc, 0, 0, W, H);
  drawSignFx(t);
  drawBacklight(t);
  drawTrees(t);
  setTarget(g);
  drawWallLive(t); drawCoffeeFx(t);
  drawBoard(); drawShelf(t, trophyGlow()); drawIcebreaker(t); drawFireworks(t); drawGarland(t);

  // всё, что стоит на полу, рисуется по глубине (y)
  const items: DepthItem[] = furnitureItems(t, { pizzaUntil: pizzaUntil(), cafeSince: cafeSince(), drawPizza });
  const ty = tigerDepthY();
  if (ty !== null) items.push({ y: ty, draw: () => drawTiger(t) });
  const ky = cakeDepthY(), vy = vacuumDepthY();
  if (ky !== null) items.push({ y: ky, draw: () => drawCake(t) });
  if (vy !== null) items.push({ y: vy, draw: () => drawVacuum(t) });
  items.push({ y: DOCK_DEPTH_Y, draw: () => drawDock(t) });
  for (const a of agents.values()) for (const i of a.interns || []) items.push({ y: i.y + 0.4, draw: () => drawIntern(i, a.kind, t) });
  for (const a of agents.values()) items.push({ y: a.y + 0.5, draw: () => drawBot(a, t) });
  for (const o of npcs) items.push({ y: o.y + 0.5, draw: () => drawNpc(o, t) });
  items.push({ y: catDepthY(), draw: () => drawCat(t) });
  items.sort((p, q) => p.y - q.y).forEach(i => { setTarget(g); i.draw(); });

  setTarget(g);
  drawRoomLight();
  for (const c of cars) drawCar(c, t);
  drawLampLight(t);
  drawOutage(t);
  drawStreetLights(t);
  drawFireflies(t);
  drawFog(t);
  drawWeather(t);
  drawStreaks(t);
  drawFlash();
  drawTreat(t);
  drawHearts();
  drawGulls(t);
  drawConfetti(t);
  for (const a of agents.values()) drawLabel(a, t);
  for (const o of npcs) drawNpcLabel(o);
}

let last = 0, drawn = false;
function loop(ms: number) {
  requestAnimationFrame(loop);
  if (modes.paused) { last = ms; return; }                 // пауза: не рисуем
  const dt = (ms - last) / 1000;
  if (drawn && dt < 1 / (gameQuiet() ? 10 : 30) - 0.002) return;   // не чаще 30 кадров в секунду, в тихом режиме игры 10
  last = ms;
  if (document.hidden) return;
  drawn = true;
  const t = ms / 1000;
  frame(t, Math.min(dt, 0.1));
  const ctx = screen.ctx!, cv = screen.cv!;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b0a16'; ctx.fillRect(0, 0, cv.width, cv.height);
  const [jx, jy] = orbit();
  ctx.drawImage(scr, view.ox + jx, view.oy + jy, W * view.ws, H * view.ws);
  ctx.save(); ctx.translate(jx, jy);
  billboardText(t);
  captions(t);
  bubbles(t);
  ctx.restore();
  drawTip();
}

/** Один опрос: данные сервера, игра и созвон, события хуков, кто в офисе. */
export async function pollOnce() {
  const t = now(), snap = await poll(t);
  setModes(snap.game, snap.mic); audio.apply();
  fxIntake(snap.fx);
  syncAgents(snap.fixed ? snap.agents : withDemo(homeFilter(showFilter(snap.agents)), t));
}

// пауза и возвращение: офис «замечает», что на него снова смотрят
let pausedAt = 0, hiddenAt = 0;
export function setPaused(p: boolean) {
  if (p === modes.paused) return;
  if (p) pausedAt = performance.now(); else onReveal(pausedAt);
  modes.paused = p;
  if (p) audio.suspend(); else audio.resume();
}

let started = false;
/** Запустить сцену на холсте (один раз на страницу). */
export function startScene(canvas: HTMLCanvasElement) {
  if (started) return;
  started = true;
  screen.cv = canvas; screen.ctx = canvas.getContext('2d');
  resize();
  addEventListener('resize', resize);
  void b;                                                      // фон рисуется renderBg() в слой b
  refreshScene();
  audio.setGate(soundAllowed);
  audio.init();
  bus.on('refresh', () => refreshScene());
  bus.on('poll-now', () => void pollOnce());
  // браузер разрешает звук только после клика; в приложении он работает сразу
  addEventListener('pointerdown', () => { audio.init(); if (!modes.paused) audio.resume(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = performance.now(); audio.suspend(); return; }
    if (!modes.paused) audio.resume();
    if (hiddenAt) { onReveal(hiddenAt); hiddenAt = 0; }
  });
  setInterval(() => { if (envTick()) refreshScene(); }, 5e3);
  setInterval(() => { if (!modes.paused) void pollOnce(); }, 2000);
  void pollOnce();
  if (document.fonts) document.fonts.load('20px Tiny5', 'Сезон AI').catch(() => {});
  requestAnimationFrame(loop);
}
