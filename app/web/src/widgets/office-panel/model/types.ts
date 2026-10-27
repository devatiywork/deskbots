// Что показывает панель на обоях. Состояние собирает сцена (pages/wallpaper передаёт его сюда),
// панель только рисует и сообщает о нажатиях.

export type ButtonKey = 'season' | 'weather' | 'sound' | 'pizza' | 'demo';

/** Строка агента: мини-голова его цветов, имя, чем занят и цвет этой подписи. */
export interface HudRow {
  id: string;
  kind: string;
  name: string;
  status: string;
  color: string;
  /** ждёт ответа: глаза мини-головы жёлтые */
  waiting: boolean;
  head: string; body: string; eye: string;
}

export interface HudButton {
  key: ButtonKey;
  text: string;
  /** короткая надпись, если длинная не влезает */
  short?: string;
  /** значок 5×5 (ключ ICON5) */
  icon: string;
  /** половинка ряда: две кнопки рядом */
  half?: boolean;
  /** ширина ровно по тексту */
  compact?: boolean;
  /** включена (демо) */
  on?: boolean;
}

export interface HudState {
  side: 'left' | 'right' | 'hidden';
  big: boolean;
  oled: boolean;
  /** панель целиком (иначе только кнопки) */
  full: boolean;
  title: string;
  clock: string;
  /** мигающее двоеточие часов */
  tick: boolean;
  online: boolean;
  /** пустой офис: что написать вместо строк */
  empty: string;
  rows: HudRow[];
  hint: string;
  stats: string[];
  sun: string;
  buttons: HudButton[];
}

export interface HudActions {
  button: (key: ButtonKey) => void;
  row: (id: string) => void;
}
