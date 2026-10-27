// Ледокол зимой: идёт по бухте в правом окне и оставляет за собой полосу чистой воды. Другим сценкам не мешает.
import { FAST, flag } from '@/shared/lib/flags';
import { rand } from '@/shared/lib/random';
import { env } from '@/entities/environment';
import { sceneRegistry } from '@/entities/world';

/** x — сдвиг корабля по стеклу окна в мелких пикселях (от 52 до −16) */
export interface Icebreaker { x: number }

let ice: Icebreaker | null = null, iceNext = flag('icebreaker') ? 8 : rand(600, 1500);

/** Ледокол в окне (null — нет). */
export const icebreaker = () => ice;

export function iceStep(dt: number, t: number) {
  if (env.season !== 'winter') { ice = null; return; }
  if (!ice) { if (t > iceNext) { ice = { x: 52 }; iceNext = t + (FAST ? 120 : rand(1500, 2700)); } return; }
  ice.x -= (flag('icebreaker') ? 2 : 0.45) * dt;
  if (ice.x < -16) ice = null;
}

sceneRegistry.add({ name: 'icebreaker', active: () => !!ice, blocks: false, step: iceStep });
