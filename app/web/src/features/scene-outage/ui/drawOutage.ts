// Затемнение офиса при отключении света: в кадр (g), после машин и света ламп, до уличных фонарей.
import { g } from '@/shared/lib/pixel/layers';
import { outageOn, powerOff } from '../model/outage';

export function drawOutage(t: number) {
  if (!outageOn()) return;
  const k = powerOff() ? 0.55 : 0.26 + (Math.sin(t * 23) > 0.92 ? 0.08 : 0);   // от генератора свет чуть мигает
  g.fillStyle = `rgba(6,6,22,${k})`; g.fillRect(72, 20, 240, 144);
}
