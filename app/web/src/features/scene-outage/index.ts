// Отключение света: регистрируется в реестре сценок при загрузке модуля.
// outageOn / powerOff / generatorOn — для рисования офиса (featureState) и звука генератора.
export { outageOn, powerOff, generatorOn, outageStep, type Outage } from './model/outage';
export { drawOutage } from './ui/drawOutage';
