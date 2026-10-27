// Мелодия «С днём рождения»: тихие квадратные ноты с басом на октаву ниже, всё расписано разом в WebAudio.
import { tone } from '@/shared/audio';

const G4 = 392, A4 = 440, B4 = 494, C5 = 523, D5 = 587, E5 = 659, F5 = 698, G5 = 784;
/** нота и длительность в долях такта */
const NOTES: [number, number][] = [
  [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [C5, 1], [B4, 2],
  [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [D5, 1], [C5, 2],
  [G4, 0.75], [G4, 0.25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 2],
  [F5, 0.75], [F5, 0.25], [E5, 1], [C5, 1], [D5, 1], [C5, 2],
];
/** одна доля, секунд */
const BEAT = 0.3;
/** длительность мелодии, секунд */
export const TUNE_LEN = NOTES.reduce((s, [, d]) => s + d, 0) * BEAT;

export function birthdayTune() {
  let w = 0;
  for (const [f, d] of NOTES) {
    tone(f, d * BEAT * 0.9, 'square', 0.012, w);
    tone(f / 2, d * BEAT * 0.9, 'triangle', 0.01, w);
    w += d * BEAT;
  }
}
