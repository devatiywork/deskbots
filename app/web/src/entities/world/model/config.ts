// Настройки, которые сцена читает каждый кадр. Заполняются из настроек приложения (pages/wallpaper применяет их).

export const config = {
  /** минут без мыши и клавиатуры — свободные агенты уходят домой (0 — никогда) */
  afkMin: 10,
  lunchOn: true, lunchH: 13, endH: 19, sleepOn: true, sleepH: 23,
  show: { claude: true, codex: true, gpt: true, ollama: true, other: true },
  panelSide: 'right' as 'right' | 'left' | 'hidden',
  panelBig: false,
  gameQuiet: true, callMute: true, scaleCrisp: false, oled: false,
  /** надпись на вывеске */
  sign: ['DESKBOTS', 'AI OFFICE'] as string[],
  /** режим Grand Ermii: приезжает ли руководство и сколько раз за рабочий день */
  ermii: true, visits: 2,
  /** руководство: Андрей и Сергей — разработчики, Фёдор — владелец и начальник; пустое имя — не приезжает */
  people: [{ look: 'me', name: 'Андрей' }, { look: 'dev', name: 'Сергей' }, { look: 'boss', name: 'Фёдор' }] as { look: 'me' | 'dev' | 'boss'; name: string }[],
};

export const SIGN_DEFAULT = ['DESKBOTS', 'AI OFFICE'];
