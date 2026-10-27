// Звук офиса синтезируется в WebAudio, без звуковых файлов.
// Фоновые «подложки» (дождь, гул, ветер, улица) играют постоянно с громкостью от сцены; события — короткие тоны и шумы.
// Можно ли звучать прямо сейчас, решает сцена через setGate (пауза, игра, созвон, закрытый рабочий стол, второй монитор).

export interface Beds { rain: GainNode; rumble: GainNode; wind: GainNode; windF: BiquadFilterNode; traffic: GainNode }

let ac: AudioContext | null = null, master: GainNode | null = null;
let WHITE: AudioBuffer | null = null, BROWN: AudioBuffer | null = null;
let beds: Beds | null = null;
let on = true, level = 0.35, gate: () => boolean = () => true;

export function filt(type: BiquadFilterType, f: number, Q = 0.7): BiquadFilterNode {
  const x = ac!.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = Q; return x;
}

export const audio = {
  /** Создаёт звук при первой возможности: браузер разрешает его только после клика, приложение — сразу. */
  init() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (ac || !AC) return;
    ac = new AC(); master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    const buf = (brown: boolean) => {
      const n = ac!.sampleRate * 2, bf = ac!.createBuffer(1, n, ac!.sampleRate), d = bf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
      return bf;
    };
    WHITE = buf(false); BROWN = buf(true);
    const bed = (brown: boolean, filters: BiquadFilterNode[]) => {
      const src = ac!.createBufferSource(), gn = ac!.createGain(); src.buffer = brown ? BROWN : WHITE; src.loop = true;
      let node: AudioNode = src; for (const f of filters) { node.connect(f); node = f; }
      gn.gain.value = 0; node.connect(gn); gn.connect(master!); src.start(); return gn;
    };
    const windF = filt('bandpass', 400, 0.8);
    beds = {
      rain: bed(false, [filt('highpass', 600), filt('lowpass', 5000)]),
      rumble: bed(true, [filt('lowpass', 260)]),
      wind: bed(true, [windF]), windF,
      traffic: bed(true, [filt('lowpass', 420)]),
    };
    audio.apply();
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  },
  /** Сцена говорит, можно ли сейчас звучать. */
  setGate(fn: () => boolean) { gate = fn; audio.apply(); },
  setOn(v: boolean) { on = v; if (v) audio.init(); audio.apply(); if (v) ac?.resume().catch(() => {}); },
  setVolume(v01: number) { level = Math.max(0, Math.min(1, v01)); audio.apply(); },
  get on() { return on; },
  get volume() { return level; },
  /** Общая громкость плавно идёт к нужной: при запрете — к нулю. */
  apply() { if (master && ac) master.gain.setTargetAtTime(on && gate() ? level : 0, ac.currentTime, 0.3); },
  /** Можно играть новый звук-событие. */
  ok: () => !!ac && on && ac.state === 'running' && gate(),
  suspend() { void ac?.suspend(); },
  resume() { ac?.resume().catch(() => {}); },
  get ctx() { return ac; },
  get beds() { return beds; },
};

export function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.1, when = 0, slideTo = 0) {
  if (!audio.ok()) return;
  const o = ac!.createOscillator(), gn = ac!.createGain(), t0 = ac!.currentTime + when;
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(gn); gn.connect(master!); o.start(t0); o.stop(t0 + dur + 0.05);
}

export function burst(dur: number, vol: number, filters: BiquadFilterNode[], when = 0, attack = 0.004, brown = false) {
  if (!audio.ok()) return;
  const src = ac!.createBufferSource(), gn = ac!.createGain(), t0 = ac!.currentTime + when;
  src.buffer = brown ? BROWN : WHITE;
  let node: AudioNode = src; for (const f of filters) { node.connect(f); node = f; }
  gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + attack); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  node.connect(gn); gn.connect(master!); src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
}

/** Ревун маяка и подобные долгие гудки с плавным нарастанием. */
export function hornNote(freq: number, when: number, dur: number, vol: number, lowpass: number) {
  if (!audio.ok()) return;
  const o = ac!.createOscillator(), f = filt('lowpass', lowpass), gn = ac!.createGain(), t0 = ac!.currentTime + when;
  o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t0);
  gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.35);
  gn.gain.setValueAtTime(vol, t0 + dur - 0.5); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(f); f.connect(gn); gn.connect(master!); o.start(t0); o.stop(t0 + dur + 0.05);
}
