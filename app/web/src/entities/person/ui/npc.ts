// Рисование людей: курьер в красном, инспектор в синей форме и каске; руководство без кепок, с причёсками.
// Спрайт — в кадр по глубине, табличка — после всех спрайтов (как у агентов).
import { neonTag } from '@/entities/agent';
import P from '@/shared/i18n/ru/person.json';
import { Q, S, q } from '@/shared/lib/pixel/canvas';
import { textQ, textW } from '@/shared/lib/pixel/font';
import type { Person, PersonLook } from '../model/person';

interface LookBase { ol: string; jk: string; jl: string; jd: string; pants: string; tagc: string }
/** гость в кепке, на табличке — кто он */
export interface GuestLook extends LookBase { cap: string; capl: string; tag: string; hair?: undefined; hairl?: undefined; hoodie?: undefined; tie?: undefined }
/** руководство: причёска, худи или костюм с галстуком; на табличке имя */
export interface HumanLook extends LookBase { hair: string; hairl: string; hoodie?: boolean; tie?: string; tag?: undefined }
export type NpcLook = GuestLook | HumanLook;

export const NPC_LOOK: Record<PersonLook, NpcLook> = {
  courier:   { ol: '#4a160e', jk: '#d9442e', jl: '#ef6a4f', jd: '#a8321f', cap: '#d9442e', capl: '#ff8a6b', pants: '#2a2540', tag: P.tag.courier, tagc: '#ff8a6b' },
  inspector: { ol: '#141a33', jk: '#2b3a6b', jl: '#3f5296', jd: '#1d2850', cap: '#c43030', capl: '#e0574f', pants: '#1d2850', tag: P.tag.inspector, tagc: '#ff6a5c' },
  // ты — разработчик в фиолетовом худи, Сергей — разработчик в зелёном худи с ноутбуком, Фёдор — владелец в костюме с галстуком
  me:   { ol: '#1a1440', jk: '#5b48d6', jl: '#7d6ef0', jd: '#3f31a8', hair: '#2a2028', hairl: '#4a3a44', pants: '#2a2540', tagc: '#b9a8ff', hoodie: true },
  dev:  { ol: '#0d2a22', jk: '#1f7a5c', jl: '#2fa37b', jd: '#155a43', hair: '#6a4a2a', hairl: '#8f6a3e', pants: '#25233a', tagc: '#7fe0b4', hoodie: true },
  boss: { ol: '#0e0d14', jk: '#2a2838', jl: '#454160', jd: '#1c1a28', hair: '#3a3036', hairl: '#8a8494', pants: '#232130', tagc: '#e6c25a', tie: '#c43c3c' },
};

export function drawNpc(o: Person, _t: number) {
  if (o.hidden) return;
  const L = NPC_LOOK[o.look], X = Math.round(o.x * S), Y = Math.round(o.y * S), T = Y - 24, dir = o.dir, walking = o.path.length > 0;
  const skin = '#e9b48c', sk = '#b97f5a';
  Q(X - 6, Y - 1, 13, 2, 'rgba(0,0,0,0.28)');
  const f = walking ? ((o.ph * 8) | 0) % 2 : 2;
  Q(X - 4, Y - 7, 8, 4, L.pants); Q(X - 4, Y - 3 - (f === 0 ? 1 : 0), 3, 3, '#1b1a1f'); Q(X + 1, Y - 3 - (f === 1 ? 1 : 0), 3, 3, '#1b1a1f');
  Q(X - 6, T + 12, 12, 10, L.ol); Q(X - 5, T + 12, 10, 9, L.jk); Q(X - 5, T + 12, 10, 1, L.jl);
  if (o.look === 'inspector') Q(X - 5, T + 17, 10, 1, '#ffcf3a');            // светоотражающая полоса
  else if (L.tie) { if (dir === 'down') { Q(X - 2, T + 12, 4, 3, '#f7f5ff'); Q(X - 1, T + 13, 2, 5, L.tie); } }   // рубашка и галстук
  else if (L.hoodie) { if (dir === 'down') { q(X - 2, T + 13, '#f7f5ff'); q(X + 1, T + 13, '#f7f5ff'); q(X - 2, T + 14, '#f7f5ff'); q(X + 1, T + 14, '#f7f5ff'); Q(X - 3, T + 18, 6, 2, L.jd); } }   // шнурки и карман
  else { Q(X - 2, T + 14, 4, 3, '#ffffff'); q(X - 1, T + 15, L.jk); }        // логотип на куртке
  const sw = walking ? ((o.ph * 8) | 0) % 2 : 0;
  Q(X - 7, T + 13 + sw, 2, 6, L.jd); Q(X + 5, T + 13 - sw, 2, 6, L.jd); Q(X - 7, T + 19 + sw, 2, 1, skin); Q(X + 5, T + 19 - sw, 2, 1, skin);
  Q(X - 4, T + 4, 8, 8, sk); Q(X - 3, T + 4, 6, 7, skin);
  if (L.hair !== undefined) {
    // причёска: сверху и по бокам; со спины затылок весь в волосах
    Q(X - 5, T + 1, 10, 5, L.ol); Q(X - 4, T + 2, 8, 3, L.hair); Q(X - 4, T + 2, 8, 1, L.hairl);
    if (dir === 'down') { Q(X - 4, T + 5, 2, 2, L.hair); Q(X + 2, T + 5, 2, 1, L.hair); q(X - 2, T + 8, '#1D1A33'); q(X + 1, T + 8, '#1D1A33'); }
    else if (dir === 'left') { Q(X, T + 5, 4, 3, L.hair); q(X - 3, T + 7, '#1D1A33'); }
    else if (dir === 'right') { Q(X - 4, T + 5, 4, 3, L.hair); q(X + 2, T + 7, '#1D1A33'); }
    else Q(X - 4, T + 4, 8, 6, L.hair);
    if (o.phone && dir !== 'up') { const px = dir === 'left' ? X - 5 : X + 3; Q(px, T + 6, 2, 4, '#1D1A33'); q(px, T + 7, '#5cc8ff'); }   // телефон у уха
  } else {
    Q(X - 5, T + 2, 10, 4, L.ol); Q(X - 4, T + 2, 8, 3, L.cap); Q(X - 4, T + 2, 8, 1, L.capl);
    if (dir === 'down') { Q(X - 5, T + 6, 10, 1, L.ol); q(X - 2, T + 8, '#1D1A33'); q(X + 1, T + 8, '#1D1A33'); }
    else if (dir === 'left') { Q(X - 7, T + 5, 3, 1, L.ol); q(X - 3, T + 7, '#1D1A33'); }
    else if (dir === 'right') { Q(X + 4, T + 5, 3, 1, L.ol); q(X + 2, T + 7, '#1D1A33'); }
    else Q(X - 3, T + 6, 6, 4, sk);
  }
  if (o.box) { Q(X - 8, T + 11, 16, 5, '#8a6a3a'); Q(X - 7, T + 11, 14, 4, '#e8d2a0'); Q(X - 2, T + 12, 4, 2, '#d9442e'); }
  if (o.pad) { const dx = dir === 'left' ? X - 9 : X + 3; Q(dx, T + 14, 6, 7, '#6b4a33'); Q(dx + 1, T + 15, 4, 5, '#f7f5ff'); Q(dx + 1, T + 16, 3, 1, '#9a92c4'); Q(dx + 1, T + 18, 2, 1, '#9a92c4'); }
  if (o.laptop) { const dx = dir === 'left' ? X + 4 : X - 9; Q(dx, T + 14, 5, 8, '#3a3848'); Q(dx + 1, T + 15, 3, 6, '#9a98aa'); q(dx + 2, T + 17, '#f7f5ff'); }   // ноутбук под мышкой
  if (o.cup && dir !== 'up') { const dx = dir === 'left' ? X - 9 : X + 5; Q(dx, T + 16, 4, 4, '#f7f5ff'); Q(dx, T + 16, 4, 1, '#8a5f3f'); }   // кружка кофе
}

/** Табличка над головой; запоминает o.labelY для облачков. */
export function drawNpcLabel(o: Person) {
  if (o.hidden) return;
  // у руководства крупная неоновая табличка с именем, как у агентов
  if (o.tag) { o.labelY = (Math.round(o.y * S) - 24) / S - 9; neonTag(o.tag.toUpperCase(), o.x, o.labelY, NPC_LOOK[o.look].tagc); return; }
  o.labelY = (Math.round(o.y * S) - 24) / S - 7;
  // в табличке нет места над буквами: Ё и Й без значков
  const L = NPC_LOOK[o.look], tag = String(o.tag || L.tag).toUpperCase().replace(/Ё/g, 'Е').replace(/Й/g, 'И'), w = textW(tag), X = Math.round(o.x * S) - Math.ceil(w / 2), Y = Math.round(o.labelY * S) + 3;
  Q(X - 3, Y - 2, w + 6, 9, '#0e0b1c'); Q(X - 2, Y - 1, w + 4, 7, L.tagc); Q(X - 1, Y, w + 2, 5, '#1c1010'); textQ(tag, X, Y, 1, L.tagc);
}
