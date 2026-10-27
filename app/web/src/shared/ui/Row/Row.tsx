import type { ReactNode } from 'react';
import s from './Row.module.scss';

/** Строка настройки: подпись с подсказкой слева, поле справа. */
export function Row({ label, hint, htmlFor, children }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children?: ReactNode }) {
  return (
    <div className={s.row}>
      <label className={s.label} htmlFor={htmlFor}>
        {label}
        {hint && <span className={s.hint}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** Значение рядом с ползунком: «35», «13:00», «никогда». */
export const Value = ({ children, wide }: { children: ReactNode; wide?: boolean }) => <span className={wide ? `${s.value} ${s.wide}` : s.value}>{children}</span>;

/** Строка без поля: просто текст или кнопки. */
export const Note = ({ children }: { children: ReactNode }) => <div className={s.row}><span className={s.label}>{children}</span></div>;
