// Люди на сцене: гости (курьер с пиццей, пожарный инспектор) и руководство на визите.
// Ходят по своему пути и говорят облачками, как агенты. Сценки создают их через npc() и сами убирают из npcs.
import { sfx } from '@/shared/audio';
import { crowd, type Face, type Place, type Pt, type Speech } from '@/entities/world';
import type { Agent } from '@/entities/agent';

export type PersonLook = 'courier' | 'inspector' | 'me' | 'dev' | 'boss';

/** Остановка на визите: за плечо к агенту, к табло, к кофемашине, звонок (выбирает фича визита). */
export interface PersonStop { kind: string; a?: Agent; x?: number; y?: number; lane?: number; face?: Face; w?: number }

/** Кто ходит по пути со своей скоростью: человек или стажёр. */
export interface Walker { x: number; y: number; path: Pt[]; dir: Face; ph: number }

export interface Person extends Walker {
  look: PersonLook;
  say: Speech | null;
  hidden: boolean;
  // что в руках: коробка с пиццей, планшет, ноутбук под мышкой, кружка, телефон у уха
  box: boolean; pad: boolean; laptop: boolean; cup: boolean; phone: boolean;
  /** имя на крупной неоновой табличке (руководство); у гостей надпись из NPC_LOOK */
  tag?: string;
  labelY?: number;
  // визит руководства: вошёл ли, проход, остановка, таймеры, колокольчик, вышел, сел в лимузин, шаги, занятое место
  inside?: boolean; lane?: number; stop?: PersonStop | null; at?: number; until?: number;
  belled?: boolean; out?: boolean; gone?: boolean; stepAt?: number; held?: Place | null; lastKind?: string;
}

export const npcs: Person[] = [];
crowd.add(() => npcs);

export function npc(look: PersonLook, x: number, y: number, path: Pt[]): Person {
  const o: Person = { look, x, y, path, dir: 'right', ph: Math.random() * 6, say: null, hidden: false, box: false, pad: false, laptop: false, cup: false, phone: false };
  npcs.push(o);
  return o;
}

export function npcSay(o: Person, text: string, t: number) { o.say = { text, until: t + 4, at: t }; sfx.blip(o.look); }

/** Облачки гостей гаснут сами (в старом движке — в конце шага сценок). */
export function npcTick(t: number) { for (const o of npcs) if (o.say && o.say.until < t) o.say = null; }

/** Шаг по пути со скоростью v клеток в секунду; true — дошёл. */
export function moveAlong(o: Walker, dt: number, v: number): boolean {
  if (!o.path.length) return true;
  const p = o.path[0], dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), s2 = v * dt;
  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) o.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  if (d <= s2) { o.x = p.x; o.y = p.y; o.path.shift(); } else { o.x += (dx / d) * s2; o.y += (dy / d) * s2; }
  o.ph += dt;
  return !o.path.length;
}
