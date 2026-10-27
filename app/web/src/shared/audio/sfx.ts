// Каталог звуков-событий. Каждый — несколько тонов и шумовых всплесков; громкости подобраны тихими, это фон рабочего стола.
import { audio, burst, filt, hornNote, tone } from './engine';

// голос в облачке: короткое «бип-бип» своей высоты у каждого агента и человека
const VOICE: Record<string, number> = {
  claude: 520, 'claude-app': 600, codex: 380, chatgpt: 700, ollama: 450, gemini: 640, grok: 340, deepseek: 560, qwen: 600,
  mistral: 480, perplexity: 660, copilot: 580, courier: 300, inspector: 250, me: 360, dev: 320, boss: 210,
};

const ok = () => audio.ok();

export const sfx = {
  blip(kind: string) { const f = VOICE[kind] || 500; for (let i = 0; i < 3; i++) tone(f * (0.9 + Math.random() * 0.25), 0.05, 'square', 0.018, i * 0.07); },
  ding() { tone(880, 0.3, 'triangle', 0.07); tone(1320, 0.4, 'triangle', 0.05, 0.13); },
  click() { if (ok()) burst(0.025, 0.05, [filt('highpass', 1800)]); },
  key() { if (ok()) burst(0.014, 0.012 + Math.random() * 0.012, [filt('bandpass', 2500 + Math.random() * 1500, 2)]); },
  thunder(delay: number) {
    if (!ok()) return;
    burst(0.5, 0.25, [filt('lowpass', 1400)], delay, 0.01);
    burst(4, 0.6, [filt('lowpass', 160)], delay + 0.05, 0.08, true);
  },
  horn(type: string) {
    if (type === 'tesla') { tone(660, 0.12, 'sine', 0.04); tone(990, 0.22, 'sine', 0.035, 0.12); }
    else if (type === 'limo') { tone(196, 0.32, 'sawtooth', 0.016); tone(247, 0.32, 'sawtooth', 0.016); }
    else if (type === 'pizza') { tone(880, 0.09, 'square', 0.02); tone(1175, 0.12, 'square', 0.02, 0.12); }
    else { tone(415, 0.13, 'square', 0.025); tone(415, 0.16, 'square', 0.025, 0.2); }
  },
  rev() { tone(70, 1.3, 'sawtooth', 0.03, 0, 190); },
  hum() { tone(95, 4, 'triangle', 0.035, 0, 105); tone(190, 4, 'sine', 0.012, 0, 210); },
  gull() { for (let i = 0; i < 3; i++) tone(1500 - i * 80, 0.22, 'sawtooth', 0.012, i * 0.26, 950); },
  gen() { tone(60, 2.5, 'sawtooth', 0.03, 0, 95); if (ok()) burst(1.2, 0.08, [filt('lowpass', 300)], 0.2, 0.3, true); },
  pop() { if (ok()) burst(0.12, 0.2, [filt('lowpass', 500)], 0, 0.003, true); tone(180, 0.6, 'sine', 0.04, 0.05, 50); },
  munch() { if (ok()) for (let i = 0; i < 4; i++) burst(0.04, 0.05, [filt('bandpass', 1400, 2)], i * 0.18); },
  door() { if (ok()) burst(0.09, 0.14, [filt('lowpass', 380)], 0, 0.004, true); },
  pour(when = 0.1) { if (ok()) burst(1.8, 0.04, [filt('bandpass', 2600, 1.2)], when, 0.25); },
  /** кофемашина сначала мелет зёрна, потом наливает */
  grind() { if (!ok()) return; burst(1.3, 0.05, [filt('bandpass', 1700, 3)], 0, 0.06); tone(140, 1.3, 'sawtooth', 0.006); sfx.pour(1.5); },
  /** кулер: бульк-бульк */
  glug() { for (let i = 0; i < 4; i++) tone(240 + Math.random() * 60, 0.09, 'sine', 0.03, 0.15 + i * 0.22, 140); },
  /** трель мобильного */
  ring() { for (let k = 0; k < 2; k++) for (let i = 0; i < 10; i++) tone(i % 2 ? 1320 : 1046, 0.05, 'square', 0.016, k * 1.2 + i * 0.055); },
  /** гудки в трубке: 425 Гц, как в России */
  dial(n = 2) { for (let i = 0; i < n; i++) tone(425, 0.8, 'sine', 0.035, i * 2.2); },
  /** вибрация в кармане */
  vibe() { for (let i = 0; i < 2; i++) tone(140, 0.2, 'sawtooth', 0.01, i * 0.32); },
  /** колокольчик над дверью офиса */
  bell() { tone(1568, 0.5, 'triangle', 0.028); tone(2093, 0.7, 'triangle', 0.02, 0.09); },
  /** шаги руководства */
  step() { if (ok()) burst(0.03, 0.022 + Math.random() * 0.01, [filt('bandpass', 950, 3)]); },
  arcade() { [523, 659, 784, 659, 1047, 784].forEach((f, i) => tone(f * (Math.random() < 0.2 ? 1.5 : 1), 0.07, 'square', 0.007, i * 0.09)); },
  snore() { if (ok()) burst(1.2, 0.03, [filt('lowpass', 260)], 0, 0.6, true); },
  /** часы на стене каждый час */
  cuckoo() { tone(784, 0.25, 'sine', 0.035); tone(622, 0.4, 'sine', 0.035, 0.32); },
  /** неон вывески щёлкает */
  buzz() { tone(120, 0.09, 'sawtooth', 0.01); },
  meow() { tone(820, 0.32, 'triangle', 0.05, 0, 520); tone(1640, 0.25, 'sine', 0.012, 0.02, 1000); },
  purr() { if (!ok()) return; for (let i = 0; i < 8; i++) burst(0.22, 0.05, [filt('lowpass', 140)], i * 0.27, 0.08, true); },
  cricket() { for (let i = 0; i < 3; i++) tone(4300, 0.035, 'sine', 0.012, i * 0.06); },
  bird() {
    const n = 2 + ((Math.random() * 3) | 0), f = 2600 + Math.random() * 900;
    for (let i = 0; i < n; i++) tone(f, 0.09, 'sine', 0.018, i * 0.13, f * (1.3 + Math.random() * 0.3));
  },
  gong() { tone(196, 2.6, 'sine', 0.09); tone(392, 1.9, 'sine', 0.03, 0.01); tone(293, 2.2, 'triangle', 0.02, 0.02); },
  fail() { tone(220, 0.18, 'square', 0.022); tone(165, 0.32, 'square', 0.022, 0.18); },
  chime() { tone(1047, 0.25, 'triangle', 0.045); tone(1319, 0.3, 'triangle', 0.04, 0.1); tone(1568, 0.45, 'triangle', 0.035, 0.2); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.16, 'square', 0.02, i * 0.14)); },
  growl() { if (ok()) burst(1.4, 0.16, [filt('lowpass', 220)], 0, 0.15, true); tone(85, 1.3, 'sawtooth', 0.02, 0, 60); },
  firework() {
    if (!ok()) return;
    tone(300 + Math.random() * 200, 0.5, 'sine', 0.01, 0, 900);
    burst(0.35, 0.07, [filt('lowpass', 900)], 0.5, 0.004, true);
    for (let i = 0; i < 5; i++) burst(0.04, 0.025, [filt('highpass', 3000)], 0.7 + i * 0.07);
  },
  /** ревун маяка в тумане: два долгих низких гудка */
  foghorn() { hornNote(92, 0, 1.8, 0.05, 380); hornNote(92, 2.4, 2.6, 0.05, 380); },
};

export type SfxName = keyof typeof sfx;
