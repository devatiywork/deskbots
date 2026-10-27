import type { ReactNode } from 'react';
import s from './Card.module.scss';

/** Карточка настроек с необязательным заголовком пиксельным шрифтом. */
export function Card({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className={s.card}>
      {title && <h2 className={`${s.title} px`}>{title}</h2>}
      {children}
    </div>
  );
}
