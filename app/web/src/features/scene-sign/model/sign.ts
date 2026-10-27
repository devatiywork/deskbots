// Новая надпись на вывеске: неон включается с миганием, потом конфетти и фанфары, агенты обсуждают.
// Шина sign — для других (руководство спрашивает, кто разрешил), confetti — салют рисует hook-fx.
import { sfx } from '@/shared/audio';
import { fill } from '@/shared/i18n';
import SG from '@/shared/i18n/ru/sign.json';
import { Q, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { pick, shuffle } from '@/shared/lib/random';
import { SIGN_DEFAULT, bus, config, later, now } from '@/entities/world';
import { sceneCrew, sceneSay } from '@/entities/agent';

/** включение неона: с какого и до какого времени; off — буквы сейчас погасли */
let signFx: { at: number; until: number; off?: boolean } | null = null;
let signTalkAt = -1e9;

/** Надпись сменили при работающем офисе (config.sign уже новая, фон перерисован). */
export function signChanged(t: number) {
  signFx = { at: t, until: t + 2.6 };
  bus.emit('sign', { lines: [...config.sign] });
  later(t + 2.7, () => { bus.emit('confetti', { x: 192, y: 18, n: 60 }); sfx.fanfare(); });
  if (t - signTalkAt < 15) return;                   // правят вторую строку сразу после первой: одно обсуждение на двоих
  signTalkAt = t;
  const back = config.sign.join('\n') === SIGN_DEFAULT.join('\n');
  const name = config.sign.map(s => s.trim()).filter(Boolean).join(' '), short = name.length > 18 ? name.slice(0, 17) + '…' : name;
  const first = back ? SG.back : name ? [...SG.new, ...SG.named.map(s => fill(s, { name: short }))] : SG.empty;
  shuffle(sceneCrew()).slice(0, 3).forEach((a, i) =>
    later(t + 3.4 + i * 2.8, () => sceneSay(a, pick(i ? SG.more : first), now())));
}

/** Как включают неон: сначала буквы чаще гаснут, к концу горят ровно; рамка горит всё время (в кадр, после фона). */
export function drawSignFx(t: number) {
  if (!signFx || t > signFx.until) return;
  const k = (t - signFx.at) / (signFx.until - signFx.at);
  const off = Math.sin(t * 41) + Math.sin(t * 17.3) > 2.4 * k - 0.6;
  if (off) { setTarget(g); Q(296, 6, 176, 28, '#17142c'); }
  else if (signFx.off) sfx.buzz();                    // трубка вспыхнула — щелчок
  signFx.off = off;
}
