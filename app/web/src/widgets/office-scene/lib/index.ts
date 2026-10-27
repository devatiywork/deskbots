// Неподвижное и декоративное рисование сцены офиса: фон, деревья, ветер, погода, столы и свет,
// мебель по глубине, стойка, кубки, билборд, табло, подсказки, сдвиг для OLED.
export { SKY, SKY_GREY, SHADOW_BASE, SHADOW_SNOW, SHADOW, ROOM_DIM, ROOM_WARM, LOOK, type Look } from './palette';
export { boxQ, bigPlantQ, potQ, vineQ, planterQ, planks, drawMoonQ, type Rnd } from './props';
export { signText, renderBg } from './background';
export { treeSprites, buildTrees, drawTrees, type TreeSprite } from './trees';
export { featureState, setFeatureState, type FeatureState } from './featureState';
export { wind, windNow, flicker, windStep, drawStreaks, drawBacklight } from './wind';
export { weatherK, ramp, clearWeather, weatherStep, newDrop, visible, drawWeather, drawFog, drawFlash } from './weather';
export { lampStep, lampLit, CODE_COLS, drawDesk, drawChairBack, drawLampLight, drawStreetLights, FLIES, drawFireflies } from './desks';
export { drawXmasTree, drawGarland } from './decor';
export { RACK, pcHot, drawRack } from './rack';
export { TROPHY_IDS, SHELF, cupAt, drawShelf, type TrophyId, type TrophyGlow } from './shelf';
export { boardBox, drawBillboard, barCol, billboardText } from './billboard';
export { drawBoard } from './board';
export { tooltip, tipAt, tipMove, tipClear, drawTip, type Tip } from './tooltip';
export { ORBIT, orbit } from './oled';
export { drawWallLive, furnitureItems, drawRoomLight, type DepthItem, type KitchenState } from './interior';
