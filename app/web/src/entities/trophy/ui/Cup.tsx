import TROPHIES from '@/shared/i18n/ru/trophies.json';
import s from './Cup.module.scss';

export type TrophyId = keyof typeof TROPHIES;
export const TROPHY_IDS = Object.keys(TROPHIES) as TrophyId[];

/** Кубок из шкафа: пиксельная чаша своего цвета; ещё не полученный — бледный. */
export function Cup({ id, got }: { id: TrophyId; got: boolean }) {
  const { title, color } = TROPHIES[id];
  return (
    <div className={got ? `${s.cup} ${s.got}` : s.cup}>
      <svg className={s.icon} viewBox="0 0 14 15" shapeRendering="crispEdges">
        <rect x="3" y="0" width="8" height="6" fill={color} />
        <rect x="1" y="1" width="2" height="3" fill={color} />
        <rect x="11" y="1" width="2" height="3" fill={color} />
        <rect x="6" y="6" width="2" height="4" fill={color} />
        <rect x="3" y="10" width="8" height="2" fill={color} />
        <rect x="4" y="1" width="2" height="1" fill="#fff" opacity=".6" />
      </svg>
      {title}
    </div>
  );
}
