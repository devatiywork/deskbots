import type { ReactNode } from 'react';
import s from './Section.module.scss';

/** Вкладка настроек: крупный заголовок пиксельным шрифтом, пояснение, карточки. */
export function Section({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <h1 className={`${s.title} px`}>{title}</h1>
      <p className={s.lead}>{lead}</p>
      {children}
    </section>
  );
}
