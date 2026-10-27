// Цвета сцены по времени суток и сезону: небо в окнах, тень на улице, свет в комнате, трава и листва.
import { env, type Phase, type Season } from '@/entities/environment';

type ByPhase<T> = Record<Phase, T>;
type Sky = [string, string, string];

export const SKY: ByPhase<Sky> = { night: ['#0d0b24', '#1a1540', '#2b205a'], dusk: ['#4c2b70', '#cf6566', '#f0a05a'], day: ['#5b9de3', '#8cc2f0', '#c4e2f6'] };
export const SKY_GREY: ByPhase<Sky> = { night: ['#0e0d1c', '#17162b', '#22203a'], dusk: ['#3b3150', '#6c5a72', '#8d7a86'], day: ['#7f8ea8', '#9eabc0', '#bcc6d6'] };
export const SHADOW_BASE: ByPhase<string | null> = { night: 'rgba(6,8,34,0.46)', dusk: 'rgba(60,20,70,0.25)', day: null };
export const SHADOW_SNOW: ByPhase<string | null> = { night: 'rgba(14,24,78,0.5)', dusk: 'rgba(60,40,110,0.25)', day: null };
/** тень на улице от времени суток: зимой по снегу синее */
export const SHADOW = new Proxy({} as ByPhase<string | null>, {
  get: (_, k) => (env.season === 'winter' ? SHADOW_SNOW : SHADOW_BASE)[k as Phase],
});
/** ночью в комнате чуть темнее, но верхний свет горит */
export const ROOM_DIM: ByPhase<string | null> = { night: 'rgba(16,10,44,0.2)', dusk: 'rgba(30,14,50,0.1)', day: null };
export const ROOM_WARM: ByPhase<number> = { night: 0.07, dusk: 0.04, day: 0 };

/** трава, кочки, цветы, листва деревьев (зимой листвы нет), весной цветки на деревьях */
export interface Look {
  grass: string; dots: string[]; flowers: string[]; nflow: number;
  leaf: [string, string, string] | null; bloom?: [string, string];
}
export const LOOK: Record<Season, Look> = {
  spring: { grass: '#5a9a55', dots: ['#66a85f', '#4e8c4a', '#72b468', '#477f44'], flowers: ['#ff9ab8', '#ffffff', '#ffd35c', '#ffc2d6', '#ff9ab8'], nflow: 220, leaf: ['#2f6e3d', '#3d8a4c', '#58a865'], bloom: ['#ffb3cf', '#ffd6e6'] },
  summer: { grass: '#4a8446', dots: ['#55934f', '#3f743d', '#5c9c57', '#3a6b3b'], flowers: ['#ffd35c', '#ff9ab8', '#ffffff', '#b9a8ff'], nflow: 110, leaf: ['#2a6337', '#357d44', '#4f9c5c'] },
  autumn: { grass: '#7b8646', dots: ['#8a934f', '#6c763c', '#9c8644', '#8f6c38'], flowers: ['#e0745f', '#ffb347', '#ffd35c', '#c4553b', '#d9702f'], nflow: 0, leaf: ['#9c3f2b', '#d06a2c', '#eeb03a'] },
  winter: { grass: '#e3e9f5', dots: ['#d3dcee', '#f3f6fc', '#c6d1e8', '#ffffff'], flowers: [], nflow: 0, leaf: null },
};
