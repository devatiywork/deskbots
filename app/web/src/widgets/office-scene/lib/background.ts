// Неподвижный фон (холст b): трава или снег, тротуар и дорога, вывеска, двор, здание, пол, стены, окна с видом
// на Владивосток, кухня. Перерисовывается, когда меняются время суток, сезон, погода или надпись на вывеске.
import { H, Q, R, S, W, discQ, lineQ, q, setTarget } from '@/shared/lib/pixel/canvas';
import { b, g } from '@/shared/lib/pixel/layers';
import { textQ, textW } from '@/shared/lib/pixel/font';
import { mix, shade } from '@/shared/lib/color';
import { rng } from '@/shared/lib/random';
import { env, isGrey, isWet, moonAge } from '@/entities/environment';
import { LAMPS, PUDDLES, SPOTS, WINDOWS, config } from '@/entities/world';
import { LOOK, SHADOW, SKY, SKY_GREY } from './palette';
import { bigPlantQ, drawMoonQ, planks, planterQ, potQ, vineQ } from './props';

/** Надпись на вывеске: строка крупными буквами, если влезает, иначе мелкими; одна строка — по центру. */
export function signText() {
  const COLS = [['#b9a8ff', '#e6e0ff'], ['#ffcf5c', '#fff3c4']];
  const lines = config.sign.map((s, i) => [String(s).trim().toUpperCase(), i] as const).filter(([s]) => s);
  const tail = /[ДЦЩ]/.test(lines[lines.length - 1]?.[0] || '') ? 1 : 0;   // хвостики нижней строки не должны лечь на рамку
  lines.forEach(([s, i], k) => {
    const px = textW(s) * 2 <= 172 ? 2 : 1, top = (lines.length === 1 ? 16 : [10, 23][k]) - tail;
    textQ(s, 384 - Math.round((textW(s) * px) / 2), top + (px === 1 ? 3 : 0), px, COLS[i][0], px === 2 ? COLS[i][1] : null);
  });
}

const BOOKS = ['#e0745f', '#5cc8ff', '#ffd35c', '#7fe0b4', '#b9a8ff', '#ff9ab8', '#f7f5ff', '#4A37C9'];

export function renderBg() {
  setTarget(b);
  const { phase, season, weather } = env;
  const r = rng(11), L = LOOK[season], winter = season === 'winter', autumn = season === 'autumn', wet = isWet();
  const out = (x: number, y: number) => !(x > 128 && x < 640 && y > 24);   // мелкие координаты: вне здания с запасом
  // трава или снег: кочки, пучки, камешки, цветы или листья
  Q(0, 0, W * S, H * S, L.grass);
  for (let i = 0; i < 9000; i++) q(r() * 768, r() * 336, L.dots[(r() * 4) | 0]);
  if (!winter) for (let i = 0; i < 420; i++) {
    const x = (r() * 768) | 0, y = (r() * 330) | 0; if (!out(x, y)) continue;
    const c1 = shade(L.grass, 0.78), c2 = shade(L.grass, 1.2);
    q(x - 2, y - 1, c1); q(x - 1, y, c1); q(x, y - 2, c1); q(x, y - 1, c1); q(x + 1, y, c1); q(x + 2, y - 1, c1); q(x, y - 3, c2); q(x + 2, y - 2, c2);
  }
  for (let i = 0; i < 26; i++) {
    const x = (r() * 760) | 0, y = (r() * 326) | 0; if (!out(x, y)) continue;
    const c = winter ? '#c3cfe6' : '#8d8a9e';
    Q(x + 1, y + 4, 6, 1, 'rgba(0,0,0,0.18)'); Q(x, y, 7, 4, shade(c, 0.8)); Q(x + 1, y, 5, 3, c); Q(x + 1, y, 3, 1, winter ? '#ffffff' : '#b4b1c4');
  }
  if (autumn) for (let i = 0; i < 520; i++) {
    const x = (r() * 768) | 0, y = (r() * 334) | 0; if (!out(x, y)) continue;
    const c = L.flowers[(r() * L.flowers.length) | 0]; Q(x, y, 2, 1, c); q(x + (r() < 0.5 ? 0 : 1), y + 1, shade(c, 0.75));
  }
  for (let i = 0; i < L.nflow; i++) {
    const x = (r() * 768) | 0, y = (r() * 330) | 0; if (!out(x, y)) continue;
    const c = L.flowers[(r() * L.flowers.length) | 0];
    q(x, y + 2, '#2f6e3d'); q(x, y - 1, c); q(x - 1, y, c); q(x + 1, y, c); q(x, y + 1, c); q(x, y, c === '#ffd35c' ? '#ff8a3c' : '#ffd35c');
  }
  if (winter) for (let i = 0; i < 140; i++) { const x = (r() * 768) | 0, y = (r() * 330) | 0; if (!out(x, y)) continue; Q(x, y, 5 + ((r() * 6) | 0), 1, '#c3cfe6'); q(x + 2, y - 1, '#ffffff'); }

  // тротуар из плитки, бордюр, дорога
  Q(0, 336, 768, 28, '#8f8ba2');
  for (let row = 0; row < 2; row++) for (let x = -12 * row; x < 768; x += 24) {
    const y = 336 + row * 14, c = shade('#b2aec2', 0.97 + r() * 0.06);
    Q(x + 1, y + 1, 22, 12, c); Q(x + 1, y + 1, 22, 1, '#c8c4d6'); Q(x + 1, y + 1, 1, 12, '#c0bcd0'); Q(x + 1, y + 12, 22, 1, '#9b97ad');
    if (r() < 0.25) { const cx = (x + 4 + r() * 14) | 0; q(cx, y + 5, '#9b97ad'); q(cx + 1, y + 6, '#9b97ad'); q(cx + 2, y + 6, '#9b97ad'); }
  }
  if (wet) Q(0, 336, 768, 28, 'rgba(40,40,90,0.14)');
  Q(0, 364, 768, 4, '#cfcbdc'); Q(0, 364, 768, 1, '#e6e2f0'); Q(0, 367, 768, 1, '#7d798f');
  const asphalt = wet ? '#28263c' : '#34324a';
  Q(0, 368, 768, 64, asphalt); Q(0, 368, 768, 2, '#1e1c30');
  for (let i = 0; i < 2600; i++) q(r() * 768, 370 + r() * 62, r() < 0.5 ? shade(asphalt, 1.18) : shade(asphalt, 0.85));
  for (let x = 8; x < 768; x += 40) { Q(x, 397, 20, 2, wet ? '#c4c0d6' : '#d8d4e6'); Q(x, 399, 20, 1, 'rgba(0,0,0,0.15)'); }
  if (wet) for (const [x, y, s] of PUDDLES) { discQ(x * 2, y * 2, s * 2, 'rgba(70,90,140,0.45)', 0.35); Q(x * 2 - s * 2 + 4, y * 2 - 2, s * 2, 1, 'rgba(200,220,255,0.35)'); }
  if (winter) {
    for (let x = 0; x < 768; x++) {
      const h = 4 + Math.round(3 + 2 * Math.sin(x * 0.35) + 3 * Math.sin(x * 0.115));
      Q(x, 336, 1, h, '#eef3fb'); if (h > 8) q(x, 336 + h - 1, '#d3dcee');
      Q(x, 362 - (x % 14 === 0 ? 2 : 0), 1, 5, '#e3e9f5');
    }
    for (let x = 0; x < 768; x += 5) if (r() < 0.6) Q(x, 370 + (r() < 0.5 ? 0 : 58), 3 + ((r() * 6) | 0), 1, '#5a5874');
  }
  // дорожка к двери
  Q(368, 328, 32, 8, '#a89d88'); for (let k = 0; k < 3; k++) { Q(370 + k * 10, 329, 8, 6, '#cfc4ae'); Q(370 + k * 10, 334, 8, 1, '#b8ad98'); }

  // вывеска: тёмный короб, неоновая рамка от розового к голубому, буквы-трубки
  Q(290, 0, 188, 40, '#0b0918'); Q(293, 3, 182, 34, '#17142c');
  for (let x = 295; x < 473; x++) { const c = mix('#ff5aa0', '#5cc8ff', (x - 295) / 178); q(x, 5, c); q(x, 34, c); }
  Q(295, 5, 1, 30, '#ff5aa0'); Q(472, 5, 1, 30, '#5cc8ff');
  signText();
  potQ(282, 38, '#cfc9df', season === 'spring' ? '#ff9ab8' : null); potQ(486, 38, '#cfc9df', season === 'spring' ? '#ff9ab8' : null);
  if (winter) { for (let x = 292; x < 476; x++) Q(x, 0, 1, 2 + (Math.sin(x * 0.45) > 0.3 ? 1 : 0), '#f4f7fd'); Q(276, 26, 13, 2, '#f4f7fd'); Q(480, 26, 13, 2, '#f4f7fd'); }

  // скамейка справа, урна, скейт, столбы фонарей
  for (const [bx, bw] of [[708, 48]]) {
    Q(bx, 311, bw, 5, '#4a3020'); Q(bx + 1, 312, bw - 2, 3, '#a8764a'); Q(bx + 1, 312, bw - 2, 1, '#c8955f');
    for (let k = 0; k < 3; k++) { const y = 318 + k * 4; Q(bx, y - 1, bw, 4, '#5a3a24'); Q(bx + 1, y, bw - 2, 2, '#b07b4c'); Q(bx + 1, y, bw - 2, 1, '#d29e66'); }
    Q(bx + 5, 329, 3, 5, '#2d2a40'); Q(bx + bw - 8, 329, 3, 5, '#2d2a40');
    if (winter) { Q(bx + 1, 310, bw - 2, 2, '#f4f7fd'); Q(bx + 1, 317, bw - 2, 2, '#f4f7fd'); }
  }
  Q(113, 319, 11, 15, '#1b1830'); Q(114, 320, 9, 13, '#4a4560'); Q(114, 320, 9, 2, '#6b6585'); Q(116, 323, 1, 9, '#5a5574'); Q(120, 323, 1, 9, '#5a5574'); Q(113, 334, 12, 2, 'rgba(0,0,0,0.25)');
  Q(470, 352, 26, 6, '#1D1A33'); Q(471, 353, 24, 4, '#4A37C9'); Q(473, 353, 9, 1, '#7d6ef0'); Q(474, 358, 3, 2, '#ffcf5c'); Q(489, 358, 3, 2, '#ffcf5c');
  for (const lx of LAMPS) {
    const X = lx * 2;
    Q(X - 4, 345, 9, 4, '#141220'); Q(X - 3, 345, 7, 1, '#3a3552');
    Q(X - 1, 316, 3, 30, '#1b1830'); Q(X - 1, 318, 1, 26, '#3a3552');
    Q(X - 5, 303, 11, 2, '#141220'); q(X, 301, '#141220'); q(X, 302, '#141220');
    Q(X - 4, 305, 9, 11, '#141220'); Q(X - 3, 306, 7, 9, '#5e5878'); Q(X - 3, 306, 7, 1, '#7a7496'); Q(X, 306, 1, 9, '#141220');
    Q(X - 3, 316, 7, 1, '#141220');
    if (winter) Q(X - 5, 302, 11, 1, '#f4f7fd');
  }
  // снеговик зимой: стоит выше, внизу слева билборд
  if (winter) {
    b.save(); b.translate(0, -42);
    discQ(118, 260, 8, '#d8e2f2'); discQ(117, 259, 7, '#ffffff'); discQ(118, 248, 6, '#d8e2f2'); discQ(117, 247, 5, '#ffffff');
    Q(114, 239, 9, 2, '#1D1A33'); Q(115, 233, 7, 6, '#1D1A33'); Q(115, 237, 7, 1, '#e0453c');
    Q(114, 245, 2, 2, '#1D1A33'); Q(119, 245, 2, 2, '#1D1A33'); Q(121, 248, 5, 2, '#ff8a3c');
    Q(110, 253, 15, 3, '#e0453c'); Q(120, 256, 3, 5, '#c43030'); q(117, 259, '#1D1A33'); q(117, 263, '#1D1A33');
    lineQ(109, 256, 101, 250, '#6b4a33'); lineQ(127, 256, 135, 250, '#6b4a33'); q(101, 249, '#6b4a33'); q(135, 249, '#6b4a33');
    b.restore();
  }
  // тень от времени суток на улице
  const shadow = SHADOW[phase];
  if (shadow) R(0, 0, W, H, shadow);

  // ---------- здание ----------
  Q(142, 38, 484, 292, '#0e0b1c');
  Q(144, 40, 480, 8, '#3b2d5c'); Q(144, 40, 480, 2, '#5a4888'); Q(144, 46, 480, 2, '#2a2046');
  Q(144, 48, 8, 268, '#3b2d5c'); Q(616, 48, 8, 268, '#3b2d5c');
  Q(144, 48, 2, 268, '#5a4888'); Q(616, 48, 2, 268, '#4a3a70'); Q(150, 48, 2, 268, '#2a2046'); Q(622, 48, 2, 268, '#2a2046');
  for (const x of SPOTS) { Q(x - 3, 41, 7, 4, '#1b1830'); Q(x - 2, 44, 5, 2, '#141220'); Q(x - 1, 45, 3, 1, '#fff3c4'); }
  if (winter) for (let x = 144; x < 624; x++) { Q(x, 37, 1, 3 + (Math.sin(x * 0.25) > 0.6 ? 2 : 0), '#f4f7fd'); if (x % 22 === 5) Q(x, 40, 1, 4 + (x % 3), '#cfe4ff'); }
  // стена: светлые панели, плинтус
  Q(152, 48, 464, 40, '#e2dcf4'); Q(152, 48, 464, 2, '#f3f0fb');
  for (let x = 184; x < 616; x += 32) Q(x, 50, 1, 28, '#d6cfee');
  Q(152, 78, 464, 10, '#c9bfe8'); Q(152, 78, 464, 1, '#ad9fd8'); Q(152, 86, 464, 2, '#8f80c4');
  // пол: в чилл-зоне тёплое дерево, в офисе светлое, на кухне плитка
  planks(152, 306, 88, 316, '#a77a52', '#7d5638', r);
  planks(308, 540, 88, 316, '#d0a271', '#a87c50', r);
  for (let y = 88; y < 316; y += 16) for (let x = 542; x < 616; x += 16) {
    const w = Math.min(16, 616 - x);
    Q(x, y, w, 16, '#ebe7f4'); Q(x, y, w, 1, '#f8f6fd'); Q(x, y, 1, 16, '#f4f1fa'); Q(x, y + 15, w, 1, '#d4cde6'); Q(x + w - 1, y, 1, 16, '#d4cde6');
    if ((x + y) % 48 === 0) { q(x + 4, y + 9, '#ffffff'); q(x + 5, y + 8, '#ffffff'); q(x + 6, y + 7, '#ffffff'); }
  }
  Q(306, 88, 2, 228, '#6b4c33'); Q(540, 88, 2, 228, '#a99dd4');
  // нижняя стена поверх пола, проём двери и коврик
  Q(144, 316, 224, 12, '#3b2d5c'); Q(400, 316, 224, 12, '#3b2d5c'); Q(144, 316, 224, 2, '#5a4888'); Q(400, 316, 224, 2, '#5a4888'); Q(144, 326, 224, 2, '#2a2046'); Q(400, 326, 224, 2, '#2a2046');
  Q(368, 316, 32, 12, '#d0a271'); Q(368, 316, 32, 1, '#e0b685'); Q(368, 326, 32, 2, '#8a6a4a'); Q(368, 316, 1, 12, '#2a2046'); Q(399, 316, 1, 12, '#2a2046');
  Q(369, 301, 30, 13, '#5e1a24'); Q(370, 302, 28, 11, '#b8333f'); for (let k = 0; k < 5; k++) Q(372, 303 + k * 2, 24, 1, '#d44a58');
  if (winter) { Q(144, 314, 224, 3, '#f4f7fd'); Q(400, 314, 224, 3, '#f4f7fd'); }
  // мягкая тень у стен
  for (let i = 0; i < 8; i++) { const a = (0.16 * (1 - i / 8)).toFixed(3); Q(152, 88 + i, 464, 1, `rgba(30,20,60,${a})`); Q(152 + i, 88, 1, 228, `rgba(30,20,60,${a})`); Q(615 - i, 88, 1, 228, `rgba(30,20,60,${a})`); }
  // солнце из окон днём
  if (phase === 'day' && !isGrey()) for (const wx of WINDOWS) for (let y = 0; y < 44; y++) Q(wx * 2 + 4 + y * 0.6, 90 + y, 46, 1, `rgba(255,248,215,${(0.16 * (1 - y / 44)).toFixed(3)})`);
  // ковёр со звёздами
  Q(158, 110, 144, 120, '#221866'); Q(160, 112, 140, 116, '#6a58e0'); Q(163, 115, 134, 110, '#221866'); Q(164, 116, 132, 108, '#3a2bb0');
  for (let i = 0; i < 800; i++) q(165 + r() * 130, 117 + r() * 106, r() < 0.85 ? '#4232bf' : '#5b4ad0');
  for (let x = 166; x < 296; x += 6) { q(x, 113, '#a99cff'); q(x, 226, '#a99cff'); }
  for (let y = 118; y < 224; y += 6) { q(161, y, '#a99cff'); q(298, y, '#a99cff'); }
  for (let i = 0; i < 26; i++) {
    const x = (168 + r() * 124) | 0, y = (120 + r() * 100) | 0, c = r() < 0.3 ? '#ffe7a3' : '#b9a8ff';
    q(x, y, c); q(x - 1, y, shade(c, 0.7)); q(x + 1, y, shade(c, 0.7)); q(x, y - 1, shade(c, 0.7)); q(x, y + 1, shade(c, 0.7));
  }
  // книжный шкаф с лианой и котом-статуэткой
  Q(155, 49, 38, 44, '#3a2416'); Q(156, 50, 36, 42, '#8a5c3a'); Q(156, 50, 36, 2, '#a8764a'); Q(158, 53, 32, 37, '#4f3624');
  for (let s = 0; s < 3; s++) {
    const sy = 53 + s * 12;
    Q(158, sy + 10, 32, 2, '#8a5c3a'); Q(158, sy + 10, 32, 1, '#a8764a');
    let x = 159;
    while (x < 189) {
      if (s === 1 && x > 176) break;
      const bw = 2 + ((r() * 3) | 0), bh = 6 + ((r() * 4) | 0), c = BOOKS[(r() * BOOKS.length) | 0];
      if (x + bw > 189) break;
      Q(x, sy + 10 - bh, bw, bh, c); Q(x, sy + 10 - bh, bw, 1, shade(c, 1.25)); Q(x, sy + 7 - (bh > 7 ? 2 : 0), bw, 1, shade(c, 0.7));
      x += bw + (r() < 0.15 ? 1 : 0);
    }
  }
  Q(179, 70, 7, 5, '#f7f5ff'); q(179, 69, '#f7f5ff'); q(185, 69, '#f7f5ff'); q(181, 71, '#1D1A33'); q(183, 71, '#1D1A33'); q(182, 72, '#ff9ab8'); Q(179, 74, 7, 1, '#d8d0f0'); Q(186, 72, 2, 1, '#f7f5ff');
  vineQ(158, 48, 36, r); vineQ(190, 48, 24, r);
  // телевизор на стене и тумба
  Q(199, 53, 62, 32, '#08070f'); Q(200, 54, 60, 30, '#1b1828'); Q(200, 54, 60, 1, '#3a3654'); Q(203, 57, 54, 23, '#16203e'); Q(226, 84, 8, 3, '#2d2a40');
  Q(195, 87, 70, 16, '#3a2416'); Q(196, 88, 68, 6, '#9a6a44'); Q(196, 88, 68, 1, '#b8875c'); Q(196, 94, 68, 8, '#7a5236');
  for (let k = 0; k < 3; k++) { Q(198 + k * 22, 95, 20, 6, '#8a5f3f'); Q(198 + k * 22, 95, 20, 1, '#9e714d'); q(207 + k * 22, 98, '#e0c08a'); q(208 + k * 22, 98, '#e0c08a'); }
  Q(203, 89, 12, 4, '#2d2a40'); Q(203, 89, 12, 1, '#4a4560'); q(212, 91, '#7fe0b4'); Q(240, 89, 6, 3, '#f7f5ff'); Q(241, 88, 4, 1, '#b9a8ff');
  potQ(255, 93, '#b5643c');
  // постер с фениксом (когда появятся кубки, поверх него шкаф с кубками)
  Q(271, 53, 30, 28, '#0e0b1c'); Q(272, 54, 28, 26, '#241c4a'); Q(273, 55, 26, 1, '#3a2f70');
  for (let i = 0; i < 10; i++) { const c = mix('#ff5c5c', '#ffcf5c', i / 10); Q(285 - i, 59 + i, 2, 2, c); Q(285 + i, 59 + i, 2, 2, c); }
  Q(285, 57, 2, 14, '#ff8a5c'); Q(285, 56, 2, 2, '#ffe7a3');
  vineQ(306, 48, 32, r);
  // доска задач
  Q(315, 51, 70, 34, '#0e0b1c'); Q(316, 52, 68, 32, '#cfc9e3'); Q(318, 54, 64, 27, '#fbfaff'); Q(320, 56, 18, 2, '#4A37C9'); Q(340, 56, 8, 2, '#b9a8ff');
  for (let c = 0; c < 3; c++) {
    const cx0 = 320 + c * 21;
    Q(cx0, 60, 18, 2, ['#b9a8ff', '#ffcf5c', '#7fe0b4'][c]);
    for (let k = 0; k < 3 - (c === 1 ? 1 : 0); k++) { const nc = ['#ffcf5c', '#7fe0b4', '#ff9ab8', '#9cc8ff'][(c + k) % 4]; Q(cx0 + 1, 64 + k * 6, 15, 4, nc); Q(cx0 + 3, 65 + k * 6, 8, 1, shade(nc, 0.7)); Q(cx0 + 3, 67 + k * 6, 5, 1, shade(nc, 0.75)); }
  }
  Q(318, 81, 64, 2, '#a49cc4'); Q(330, 80, 4, 1, '#e0453c'); Q(337, 80, 4, 1, '#4A37C9');
  // окна: вид на Владивосток — сопки, бухта, Золотой мост; зимой бухта во льду
  const grey = isGrey() && phase !== 'night', sky = grey || (winter && phase !== 'night') ? SKY_GREY[phase] : SKY[phase], night = phase === 'night';
  for (const wx of WINDOWS) {
    const X = wx * 2, gx = X + 1, gy = 53, gw = 50, gh = 30;
    Q(X - 3, 49, 58, 38, '#0e0b1c'); Q(X - 2, 50, 56, 36, '#2b2548');
    for (let y = 0; y < gh; y++) { const k = (y / (gh - 1)) * 2; Q(gx, gy + y, gw, 1, k < 1 ? mix(sky[0], sky[1], k) : mix(sky[1], sky[2], k - 1)); }
    if (night) {
      for (let i = 0; i < 9; i++) q(gx + r() * gw, gy + r() * 14, r() < 0.7 ? '#ffffff' : '#b9a8ff');
      if (wx === WINDOWS[1] && !grey) drawMoonQ(gx + 38, gy + 7, 4, mix(sky[0], '#ffffff', 0.07));
    } else if (!grey && !winter) { Q(gx + 6, gy + 6, 14, 3, '#ffffff'); Q(gx + 9, gy + 4, 8, 2, '#ffffff'); Q(gx + 30, gy + 10, 10, 2, '#eef6ff'); }
    else { Q(gx + 2, gy + 4, 24, 4, '#d5dbe6'); Q(gx + 6, gy + 2, 12, 2, '#dfe4ec'); Q(gx + 28, gy + 8, 20, 3, '#c9d0de'); }
    const seaY = gy + gh - 7, off = (wx - WINDOWS[0]) * 2;          // силуэт сопок продолжается из окна в окно
    const hill = night ? ['#1a1638', '#241d4c'] : grey ? ['#7d8a9a', '#8e9aab'] : winter ? ['#8a98b0', '#a3b0c4'] : ['#4f7a5a', '#629068'];
    for (let x = 0; x < gw; x++) {
      const k = off + x;
      const h1 = 10 + Math.round(3 * Math.sin(k * 0.09) + 2 * Math.sin(k * 0.23 + 1));
      const h2 = 5 + Math.round(2.5 * Math.sin(k * 0.15 + 2) + 1.5 * Math.sin(k * 0.37));
      Q(gx + x, seaY - h1, 1, h1, hill[0]); Q(gx + x, seaY - h2, 1, h2, hill[1]);
      if (winter) q(gx + x, seaY - h1, '#f4f7fd');
    }
    for (let i = 0; i < (night ? 24 : 10); i++) {                  // дома на сопках, ночью огоньки
      const x = gx + ((r() * gw) | 0), y = seaY - 1 - ((r() * 8) | 0);
      q(x, y, night ? (r() < 0.8 ? '#ffd98a' : '#9cc8ff') : r() < 0.5 ? '#eef0f5' : '#c9d2de');
    }
    const sea = winter ? ['#cdd9e6', '#e4ecf5'] : night ? ['#121836', '#1a2148'] : grey ? ['#6a7b90', '#7889a0'] : ['#3c79ad', '#5592c8'];
    for (let y = seaY; y < gy + gh; y++) Q(gx, y, gw, 1, (y - seaY) % 2 ? sea[0] : sea[1]);
    for (let i = 0; i < 6; i++) Q(gx + ((r() * (gw - 4)) | 0), seaY + 1 + ((r() * 5) | 0), 3, 1, winter ? '#ffffff' : night ? '#2f3d70' : '#a8d4f2');
    if (night && !winter) for (let i = 0; i < 6; i++) Q(gx + ((r() * (gw - 2)) | 0), seaY + 1 + ((r() * 5) | 0), 2, 1, 'rgba(255,217,138,0.55)');
    // лунная дорожка на воде; зимой на льду рыбаки с палатками
    const lit = (1 - Math.cos(2 * Math.PI * moonAge())) / 2;
    if (night && !grey && !winter && wx === WINDOWS[1] && lit > 0.15) for (let i = 0; i < 3; i++) Q(gx + 37 - i, seaY + 1 + i * 2, 3 + i * 2, 1, `rgba(255,246,216,${(0.2 + 0.4 * lit).toFixed(2)})`);
    if (winter) {
      const rf = rng(77 + wx);
      for (let i = 0; i < 4; i++) {
        const fx = gx + 3 + ((rf() * (gw - 10)) | 0), fy = seaY + 2 + ((rf() * 3) | 0);
        Q(fx, fy - 2, 3, 2, ['#e0453c', '#3f9fd0', '#ffcf5c', '#7fe0b4'][i]); q(fx + 4, fy - 1, '#1D1A33'); q(fx + 4, fy, '#4a4560');
      }
    }
    if (wx === WINDOWS[0]) {
      // Золотой мост: два пилона-«Λ», веер вант, полотно над бухтой
      const deckY = seaY - 3, col = night ? '#4a4280' : grey ? '#d5d9e2' : '#eceaf4', cab = night ? 'rgba(150,140,220,0.55)' : 'rgba(255,255,255,0.7)';
      for (const px of [gx + 13, gx + 37]) {
        const top = gy + 4;
        for (let k = 1; k <= 5; k++) { lineQ(px, top + 2, px - k * 2.3, deckY, cab); lineQ(px, top + 2, px + k * 2.3, deckY, cab); }
        lineQ(px - 3, deckY + 3, px, top, col); lineQ(px + 3, deckY + 3, px, top, col); Q(px - 1, top - 1, 3, 2, col);
        if (night) q(px, top - 2, '#ff5c5c');
      }
      Q(gx, deckY, gw, 2, col); Q(gx, deckY + 2, gw, 1, shade(col, 0.7));
      if (night) for (let x = gx + 2; x < gx + gw; x += 5) q(x, deckY - 1, '#ffd98a');
    } else {
      // у причала сухогруз с контейнерами и портовый кран, в бухте катер
      const hull = night ? '#1d1838' : '#38334e', deck = night ? '#2a2350' : '#e8e4f0', crane = night ? '#3a3360' : '#e0a030';
      Q(gx + 6, seaY - 3, 20, 4, hull); Q(gx + 6, seaY - 3, 20, 1, '#c43030');
      Q(gx + 19, seaY - 7, 6, 4, deck); Q(gx + 20, seaY - 6, 4, 1, night ? '#ffd98a' : '#7d8fa4');
      Q(gx + 9, seaY - 6, 3, 3, '#e0745f'); Q(gx + 13, seaY - 6, 3, 3, '#5cc8ff');
      Q(gx + 30, seaY - 14, 1, 11, crane); lineQ(gx + 30, seaY - 14, gx + 38, seaY - 10, crane);
      Q(gx + 38, seaY + 2, 6, 2, deck); q(gx + 39, seaY + 1, '#c43030');
      if (night) { q(gx + 8, seaY - 2, '#ffd98a'); q(gx + 16, seaY - 2, '#ffd98a'); q(gx + 30, seaY - 15, '#ff5c5c'); }
    }
    if (weather === 'fog') Q(gx, seaY - 6, gw, 8, night ? 'rgba(120,128,170,0.45)' : 'rgba(232,236,244,0.7)');
    for (let i = 0; i < 7; i++) { q(gx + 3 + i, gy + 12 - i, 'rgba(255,255,255,0.16)'); q(gx + 30 + i, gy + 16 - i, 'rgba(255,255,255,0.12)'); }
    Q(X + 24, 50, 3, 36, '#2b2548'); Q(X + 25, 50, 1, 36, '#3e3666');
    Q(X - 4, 84, 60, 4, '#f3f0fb'); Q(X - 4, 87, 60, 1, '#c9bfe8');
    potQ(X + 6, 85, '#b5643c', season === 'spring' ? '#ff9ab8' : null); potQ(X + 46, 85, '#eeeaf6');
  }
  // часы (стрелки рисуются каждый кадр)
  discQ(524, 64, 12, '#0e0b1c'); discQ(524, 64, 11, '#2b2548'); discQ(524, 64, 9, '#ffffff'); discQ(525, 65, 8, '#f3f0fb');
  for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283; q(524 + Math.round(Math.cos(a) * 8), 64 + Math.round(Math.sin(a) * 8), k % 3 ? '#b9b2d6' : '#1D1A33'); }
  vineQ(536, 48, 28, r);
  // кухня: шкафчики, столешница с кофемашиной, чайником и микроволновкой, холодильник, кулер
  Q(543, 49, 70, 24, '#8f86b0'); Q(544, 50, 68, 22, '#f6f4fc'); Q(544, 50, 68, 1, '#ffffff'); Q(544, 70, 68, 2, '#c9c1e6');
  for (let k = 0; k < 4; k++) { Q(544 + k * 17 + 16, 50, 1, 20, '#d8d0ec'); Q(544 + k * 17 + (k % 2 ? 3 : 12), 58, 1, 5, '#9a8fb8'); }
  Q(543, 87, 70, 18, '#3a3550'); Q(544, 88, 68, 6, '#5b5670'); Q(544, 88, 68, 1, '#7a7494'); Q(544, 94, 68, 10, '#ece8f6'); Q(544, 94, 68, 1, '#cfc8e6');
  for (let k = 1; k < 4; k++) Q(544 + k * 17, 94, 1, 10, '#cfc8e6');
  for (let k = 0; k < 4; k++) Q(549 + k * 17, 98, 6, 1, '#9a8fb8');
  Q(549, 75, 20, 20, '#0e0b1c'); Q(550, 76, 18, 18, '#2d2a40'); Q(550, 76, 18, 2, '#4a4560'); Q(552, 79, 14, 5, '#141220'); q(563, 80, '#ff5c5c'); Q(554, 81, 4, 1, '#7fe0b4'); Q(557, 86, 4, 2, '#141220'); Q(556, 89, 6, 4, '#f7f5ff'); q(562, 90, '#d8d0f0');
  Q(576, 83, 10, 7, '#6c7388'); Q(577, 83, 8, 6, '#9ca3b8'); Q(577, 83, 8, 1, '#c9cfdc'); Q(578, 80, 6, 2, '#6c7388'); q(586, 85, '#6c7388');
  Q(595, 75, 18, 14, '#6c7388'); Q(596, 76, 16, 12, '#cfd3e0'); Q(597, 78, 10, 8, '#2a2838'); q(598, 79, '#4a4560'); Q(609, 78, 2, 1, '#7fe0b4'); Q(609, 81, 2, 1, '#9ca3b8'); Q(609, 84, 2, 1, '#9ca3b8');
  Q(595, 111, 20, 44, '#6c7388'); Q(596, 112, 18, 42, '#dfe3ee'); Q(596, 112, 18, 1, '#ffffff'); Q(613, 112, 1, 42, '#bcc3d4'); Q(596, 132, 18, 1, '#aab1c4');
  Q(598, 118, 1, 8, '#9ca3b8'); Q(598, 136, 1, 8, '#9ca3b8');
  Q(604, 116, 3, 3, '#ffcf5c'); Q(609, 121, 2, 2, '#ff9ab8'); Q(603, 125, 3, 2, '#5cc8ff'); Q(606, 137, 6, 7, '#fff6c8'); Q(607, 139, 4, 1, '#b9b2d6'); Q(607, 141, 3, 1, '#b9b2d6'); Q(602, 146, 2, 2, '#7fe0b4');
  Q(601, 153, 12, 13, '#2a7ad0'); Q(602, 154, 10, 12, '#7fc8ff'); Q(603, 155, 2, 9, '#c8e8ff'); Q(605, 166, 4, 2, '#4aa8ff');
  Q(599, 168, 16, 21, '#7d8296'); Q(600, 168, 14, 20, '#e1e5ef'); Q(600, 168, 14, 1, '#ffffff'); Q(602, 173, 2, 2, '#5cc8ff'); Q(602, 177, 2, 2, '#ff5c5c'); Q(601, 182, 12, 1, '#b8bfd0');
  // коврик под кухонным столом
  discQ(588, 238, 22, '#bfb098', 0.6); discQ(588, 238, 20, '#dccfb8', 0.6); discQ(588, 238, 14, '#d3c5ad', 0.6);
  // бра на левой стене
  Q(154, 120, 4, 7, '#4a3a70'); Q(155, 116, 4, 4, '#ffe7a3'); q(156, 116, '#fff6d8');
  // низкая полка у аркады: книги, лампа, растение
  Q(193, 249, 38, 20, '#3a2416'); Q(194, 250, 36, 4, '#8a5c3a'); Q(194, 250, 36, 1, '#a8764a'); Q(194, 254, 36, 14, '#5a3d28'); Q(196, 256, 32, 10, '#3a2618');
  for (let k = 0; k < 5; k++) Q(198 + k * 3, 257, 2, 9, BOOKS[k]);
  Q(214, 259, 6, 7, '#2d2a40'); Q(222, 258, 5, 8, '#b9a8ff');
  Q(220, 247, 9, 3, '#2d2a40'); Q(224, 241, 1, 6, '#2d2a40'); Q(220, 235, 9, 6, '#ffe7a3'); Q(220, 235, 9, 1, '#fff6d8'); Q(221, 240, 7, 1, '#e8c27a');
  bigPlantQ(202, 250, 14, r);
  // коврик для кота
  Q(246, 238, 34, 18, '#5a4a78'); Q(248, 240, 30, 14, '#8a7aa8'); Q(250, 242, 26, 10, '#9d8ebb');
  for (let x = 248; x < 279; x += 3) { q(x, 237, '#6a5a88'); q(x, 256, '#6a5a88'); }
  // торшер у дивана
  discQ(165, 208, 4, '#2d2a40', 0.6); Q(164, 184, 2, 24, '#2d2a40'); Q(158, 176, 14, 9, '#3a2416'); Q(159, 177, 12, 7, '#ffe2a0'); Q(159, 177, 12, 1, '#fff3cf'); Q(160, 183, 10, 1, '#e8c27a');
  // растения в кадках и цветочные ящики у входа
  bigPlantQ(298, 108, 20, r); bigPlantQ(320, 314, 20, r); bigPlantQ(532, 314, 22, r); bigPlantQ(606, 314, 24, r, '#b5643c'); bigPlantQ(556, 314, 16, r);
  planterQ(332, 296, 30, r); planterQ(406, 296, 30, r);
  Q(362, 301, 5, 12, '#5e1a1a'); Q(363, 303, 3, 9, '#d43a3a'); Q(363, 303, 3, 1, '#ff7a6a'); Q(363, 300, 3, 2, '#2d2a40'); q(366, 304, '#2d2a40');   // огнетушитель у двери
  // живая изгородь вдоль здания
  for (const [x0, x1] of [[152, 364], [404, 616]]) {
    const dark = autumn ? '#4f5a26' : '#1f4f2c', mid = autumn ? '#6c7836' : '#357a44', hi = autumn ? '#8d9a48' : '#4f9c5c';
    Q(x0, 330, x1 - x0, 6, dark);
    for (let x = x0 + 3; x < x1 - 2; x += 7) { discQ(x, 331, 4, dark); discQ(x - 1, 330, 3, mid); q(x - 2, 328, hi); q(x, 329, hi); q(x + 1, 331, shade(mid, 1.1)); }
    if (winter) { for (let x = x0; x < x1; x++) Q(x, 326 + (Math.sin(x * 0.5) > 0.5 ? 0 : 1), 1, 3, '#f4f7fd'); continue; }
    for (let x = x0 + 4; x < x1; x += 6) {
      const c = autumn ? ['#d06a2c', '#eeb03a', '#9c3f2b'][((x / 6) | 0) % 3] : ['#ffffff', '#ffd35c', '#ff9ab8'][((x / 6) | 0) % 3];
      q(x, 330 + (x % 3), c);
    }
  }
  setTarget(g);
}
