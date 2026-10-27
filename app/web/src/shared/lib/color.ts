// Цвета #rrggbb: светлее и темнее (shade), смесь двух (mix).

const hexRgb = (hex: string): number[] => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (a: number[]) => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

export const shade = (hex: string, k: number) => toHex(hexRgb(hex).map(v => v * k));
export const mix = (h1: string, h2: string, k: number) => { const a = hexRgb(h1), c = hexRgb(h2); return toHex(a.map((v, i) => v + (c[i] - v) * k)); };
