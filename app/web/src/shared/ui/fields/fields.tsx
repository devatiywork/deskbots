// Поля настроек: переключатель, ползунок, список, текст, число, кнопка.
import { useEffect, useState, type ReactNode } from 'react';
import s from './fields.module.scss';

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={s.switch}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Range({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return <input className={s.range} type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} />;
}

export function Select<T extends string>({ id, value, options, onChange }: { id?: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <select id={id} className={s.select} value={value} onChange={e => onChange(e.target.value as T)}>
      {(Object.keys(options) as T[]).map(k => <option key={k} value={k}>{options[k]}</option>)}
    </select>
  );
}

/**
 * Текстовое поле: правка идёт локально, сохраняется по Enter или когда уходишь из поля.
 * clean убирает недопустимые знаки прямо при вводе.
 */
export function TextField({ id, value, maxLength, clean, upper, onCommit }: {
  id?: string; value: string; maxLength: number; clean?: (v: string) => string; upper?: boolean; onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  const commit = () => { setEditing(false); if (draft !== value) onCommit(draft); };
  return (
    <input
      id={id} type="text" className={upper ? `${s.text} ${s.upper}` : s.text} value={draft} maxLength={maxLength}
      spellCheck={false} autoComplete="off"
      onFocus={() => setEditing(true)}
      onChange={e => setDraft(clean ? clean(e.target.value) : e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); }}
    />
  );
}

export function NumberField({ value, min, max, step, onCommit }: { value: number; min: number; max: number; step: number; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => { const n = Number(draft); if (Number.isFinite(n) && n !== value) onCommit(n); else setDraft(String(value)); };
  return <input className={s.number} type="number" min={min} max={max} step={step} value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); }} />;
}

export function Button({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className={s.button} onClick={onClick} disabled={disabled}>{children}</button>;
}

/** Цветной квадратик и текст: зелёный — всё хорошо, жёлтый — внимание, красный — ошибка. */
export function Status({ kind, children }: { kind: 'ok' | 'warn' | 'bad' | 'none'; children: ReactNode }) {
  return <span className={`${s.status} ${s[kind]}`}>{children}</span>;
}

/** Полоска из 20 делений: до 60% зелёная, до 85% жёлтая, дальше красная; color — одним цветом. */
export function Bar({ pct, color }: { pct: number; color?: string }) {
  const lit = Math.round(Math.max(0, Math.min(100, pct)) / 5);
  return (
    <div className={s.bar}>
      {Array.from({ length: 20 }, (_, i) => (
        <i key={i} style={i < lit ? { background: color || (i >= 17 ? '#ff5c5c' : i >= 12 ? '#ffcf5c' : '#7fe0b4') } : undefined} />
      ))}
    </div>
  );
}
