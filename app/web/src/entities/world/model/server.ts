// Что сцена знает о компьютере и программах: данные от встроенного сервера и режимы окна.
import type { DayStats, Limits, PcStats, WeekDay } from '@/shared/api/types';
import { flag } from '@/shared/lib/flags';
import { config } from './config';

export const server = {
  /** сервер отвечает */
  online: false,
  dayStats: null as DayStats | null,
  weekData: null as WeekDay[] | null,
  limits: null as Limits | null,
  pcStats: null as PcStats | null,
  trophies: [] as string[],
  /** на каком-то мониторе игра или видео на весь экран */
  gameOn: false,
  /** какая-то программа держит микрофон (созвон) */
  micOn: false,
  /** сколько мс не трогали мышь и клавиатуру */
  userIdleMs: 0,
  /** экран заблокирован */
  locked: false,
};

/** Режимы окна обоев. */
export const modes = {
  /** офис не на главном мониторе: молчит, звук играет одно окно */
  second: false,
  /** рабочий стол закрыт окнами: офис молчит совсем */
  deskHidden: false,
  /** пауза из трея или настроек */
  paused: false,
};

/** Компьютер перегрет: процессор под 95% или видеокарта горячее 82° (#hot — для проверки). */
export const pcHot = () => flag('hot') || (!!server.pcStats && (server.pcStats.cpu >= 95 || (server.pcStats.gpu?.temp || 0) >= 82));

export const gameQuiet = () => server.gameOn && config.gameQuiet;
export const callQuiet = () => server.micOn && config.callMute;
/** Можно ли сейчас звучать (пауза отдельно: при ней звук приостановлен целиком). */
export const soundAllowed = () => !modes.second && !modes.deskHidden && !gameQuiet() && !callQuiet();
