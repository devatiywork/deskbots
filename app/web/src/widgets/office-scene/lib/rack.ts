// Серверная стойка в углу комнаты отдыха: огоньки мигают от нагрузки, полоски — процессор, видеокарта, память.
import { Q, q } from '@/shared/lib/pixel/canvas';
import { flag } from '@/shared/lib/flags';
import type { PcStats } from '@/shared/api/types';
import { server } from '@/entities/world';

/** стойка в мелких пикселях */
export const RACK = { x: 276, y: 270, w: 24, h: 42 };

/** Компьютер перегрет: процессор под 95% или видеокарта от 82°. */
export const pcHot = () => flag('hot') || (!!server.pcStats && (server.pcStats.cpu >= 95 || (server.pcStats.gpu?.temp || 0) >= 82));

export function drawRack(t: number) {
  const { x, y, w, h } = RACK, p: PcStats = server.pcStats || { cpu: 6, mem: 40 }, gl = p.gpu?.load ?? 0;
  Q(x + 2, y + h, w, 3, 'rgba(0,0,0,0.25)');
  Q(x - 1, y - 1, w + 2, h + 2, '#0b0918'); Q(x, y, w, h, '#2b2740'); Q(x, y, w, 1, '#4a4466'); Q(x + w - 2, y + 1, 2, h - 1, '#1f1c30');
  // табло: три полоски нагрузки (процессор, видеокарта, память)
  Q(x + 2, y + 2, w - 5, 10, '#0e0b1c');
  ([[p.cpu, '#7fe0b4'], [gl, '#5cc8ff'], [p.mem, '#b9a8ff']] as [number, string][]).forEach(([v, col], i) => {
    const bh = Math.max(1, Math.round((Math.min(100, v) / 100) * 8));
    Q(x + 4 + i * 6, y + 11 - bh, 4, bh, v >= 90 ? (((t * 4) | 0) % 2 ? '#ff5c5c' : '#ff9a4a') : col);
  });
  // три сервера: щели и огоньки, чем выше нагрузка, тем чаще мигают
  for (let u = 0; u < 3; u++) {
    const uy = y + 14 + u * 7;
    Q(x + 2, uy, w - 5, 6, '#1b1830'); Q(x + 2, uy, w - 5, 1, '#3a3552');
    for (let k = 0; k < 4; k++) Q(x + 4 + k * 3, uy + 3, 2, 1, '#0e0b1c');
    for (let k = 0; k < 3; k++) {
      const on = Math.sin(t * (1 + p.cpu / 12 + k) * 3 + u * 1.7 + k * 2.3) > 0.2 - p.cpu / 120;
      q(x + 16 + k * 2, uy + 2, on ? ['#7fe0b4', '#ffcf5c', '#5cc8ff'][k] : '#2d3a33');
    }
  }
  // вентилятор внизу крутится быстрее, когда грузят видеокарту
  const fx = x + 4, fy = y + 35, spin = ((t * (2 + gl / 8)) | 0) % 2;
  Q(fx - 1, fy - 1, 7, 7, '#141220'); Q(fx, fy, 5, 5, '#3a3552');
  if (spin) { Q(fx + 2, fy, 1, 5, '#8a82b0'); Q(fx, fy + 2, 5, 1, '#8a82b0'); }
  else for (let k = 0; k < 5; k++) { q(fx + k, fy + k, '#8a82b0'); q(fx + 4 - k, fy + k, '#8a82b0'); }
  for (let k = 0; k < 3; k++) Q(x + 12, fy + k * 2, w - 15, 1, '#1b1830');   // решётка
  // перегрев: дымок сверху
  if (pcHot()) for (let i = 0; i < 5; i++) {
    const pp = (t * 0.6 + i / 5) % 1;
    Q(x + 6 + i * 3 + Math.round(Math.sin(t * 2 + i) * 2), y - 2 - pp * 18, 2, 2, `rgba(200,200,215,${(0.6 * (1 - pp)).toFixed(2)})`);
  }
}
