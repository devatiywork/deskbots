// День рождения: регистрируется в реестре сценок при загрузке модуля.
// drawCake — торт на кухонном столе, в кадре по глубине сразу после стола: cakeDepthY() (null — торта нет).
export { birthday, birthdayStep, cakeOn, cakeState, cakeDepthY, type Birthday } from './model/birthday';
export { CAKE_X, CAKE_Y, CAKE_TIME, CAKE_DEPTH_Y } from './lib/cake';
export { drawCake } from './ui/drawCake';
