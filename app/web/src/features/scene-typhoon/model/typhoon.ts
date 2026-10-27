// Тайфун: по реальной погоде (ветер от 55 км/ч или порывы от 80) или #typhoon. Ветер почти на пределе,
// агенты говорят про ветер (реплики typhoon в lines.json — у болтовни агентов). Другим сценкам не мешает.
import { has } from '@/shared/lib/flags';
import { pick } from '@/shared/lib/random';
import T from '@/shared/i18n/ru/scenes.json';
import { env } from '@/entities/environment';
import { bus, later, now, presence, sceneRegistry } from '@/entities/world';
import { sceneCrew, sceneSay } from '@/entities/agent';

export const isTyphoon = () => has('typhoon') || (env.weatherPick === 'real' && !!env.realW?.typhoon);

/** Тайфун начался или кончился: presence.typhoon, перерисовка фона, штормовое предупреждение. */
export function typhoonStep(t: number) {
  const on = isTyphoon();
  if (on === presence.typhoon) return;
  presence.typhoon = on;
  bus.emit('refresh', null);
  if (!on) return;
  const c = sceneCrew();
  sceneSay(c[0], T.typhoon.warning, t);
  if (c[1]) later(t + 4.2, () => sceneSay(c[1], pick(T.typhoon.windows), now()));
}

sceneRegistry.add({ name: 'typhoon', active: () => presence.typhoon, blocks: false, step: (_dt, t) => typhoonStep(t) });
