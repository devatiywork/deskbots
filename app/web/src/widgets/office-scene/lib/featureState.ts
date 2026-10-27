// Состояние фич, от которого зависит рисование офиса: тайфун и отключение света.
// Виджет не берёт его из фич сам — сборщик кадра выставляет его через setFeatureState.

export interface FeatureState {
  /** тайфун: ветер почти на пределе */
  typhoon: boolean;
  /** идёт отключение света (и при генераторе тоже): настольные лампы не горят */
  outage: boolean;
  /** свет отключён и генератор ещё не запущен: мониторы погасли, нет подсветки и света ламп */
  powerOff: boolean;
}

export const featureState: FeatureState = { typhoon: false, outage: false, powerOff: false };

export const setFeatureState = (p: Partial<FeatureState>) => { Object.assign(featureState, p); };
