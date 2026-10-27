// Строки, привязанные к одной настройке: переключатель, ползунок, список, имя.
import type { Settings } from '@/shared/api/types';
import { useSetting } from '@/entities/settings';
import { Range, Row, Select, Switch, TextField, Value } from '@/shared/ui';

type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type NumKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];
type StrKey = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];

export function SwitchRow({ k, label, hint }: { k: BoolKey; label: string; hint?: string }) {
  const [v, set] = useSetting(k);
  return <Row label={label} hint={hint}><Switch checked={!!v} onChange={set} /></Row>;
}

/** Ползунок с подписью значения: unit дописывается в конец, zero — что писать вместо нуля. */
export function RangeRow({ k, label, hint, min, max, unit = '', zero }: { k: NumKey; label: string; hint?: string; min: number; max: number; unit?: string; zero?: string }) {
  const [v, set] = useSetting(k);
  const n = v ?? min;
  return (
    <Row label={label} hint={hint}>
      <Range value={n} min={min} max={max} onChange={set} />
      <Value>{n === 0 && zero ? zero : `${n}${unit}`}</Value>
    </Row>
  );
}

export function SelectRow<K extends StrKey>({ k, label, hint, options }: { k: K; label: string; hint?: string; options: Record<string, string> }) {
  const [v, set] = useSetting(k);
  return (
    <Row label={label} hint={hint} htmlFor={k}>
      <Select id={k} value={String(v ?? '')} options={options} onChange={x => set(x as Settings[K])} />
    </Row>
  );
}

/** Имя человека Grand Ermii: буквы, цифры, пробел, дефис и точка. */
const cleanName = (v: string) => v.replace(/[^A-Za-zА-Яа-яЁё0-9 \-.]/g, '');
export function NameRow({ k, label, hint }: { k: 'p1name' | 'p2name' | 'p3name'; label: string; hint?: string }) {
  const [v, set] = useSetting(k);
  return <Row label={label} hint={hint} htmlFor={k}><TextField id={k} maxLength={14} clean={cleanName} value={v ?? ''} onCommit={set} /></Row>;
}
