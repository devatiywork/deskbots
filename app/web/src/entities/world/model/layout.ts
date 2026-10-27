// Планировка офиса в клетках сцены.
// Здание x 72..312, y 20..164. Стена с окнами 24..44, пол 44..158, дверь внизу x 184..200.
// Слева чилл-зона (x 76..150), коридор x 154, рабочие столы (x 158..266), справа кухня (x 270..308).
// Место (Place) — куда можно прийти: проход (lane), путь от прохода (entry), куда смотреть, сидя ли, чем занят.

export interface Pt { x: number; y: number }
export type Face = 'up' | 'down' | 'left' | 'right';
/** чем занят на месте: значок над головой и строка в панели */
export type Act = 'tv' | 'tea' | 'music' | 'game' | 'coffee' | 'phone' | 'brief' | 'bench' | 'pizza' | 'serve' | string;

export interface Place {
  lane: number;
  entry: Pt[];
  face: Face;
  sit?: boolean;
  act?: Act;
  /** кто сейчас занял: агент или человек */
  owner?: object | null;
  desk?: boolean;
  street?: boolean;
  out?: boolean;
}

export interface Desk extends Place {
  x0: number; y0: number; cx: number;
  lamp: number; lampOn: number; lampAt?: number;
}

/** вертикальный коридор между чилл-зоной и столами: по нему переходят из прохода в проход */
export const V = 154;

export const DESKS: Desk[] = [];
for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
  const x0 = 158 + i * 28, y0 = r ? 92 : 52, cx = x0 + 12;
  DESKS.push({ x0, y0, cx, lane: y0 + 26, entry: [{ x: cx, y: y0 + 26 }, { x: cx, y: y0 + 20 }], face: 'up', sit: true, owner: null, desk: true, lamp: 0, lampOn: 0 });
}

export const CHILL: Place[] = ([
  { lane: 82, entry: [{ x: 104, y: 82 }, { x: 104, y: 99 }], face: 'up', sit: true, act: 'tv' },
  { lane: 82, entry: [{ x: 126, y: 82 }, { x: 126, y: 99 }], face: 'up', sit: true, act: 'tv' },
  { lane: 142, entry: [{ x: 284, y: 142 }, { x: 284, y: 118 }], face: 'right', sit: true, act: 'tea' },
  { lane: 82, entry: [{ x: 84, y: 82 }, { x: 84, y: 75 }], face: 'up', sit: true, act: 'music' },
  { lane: 142, entry: [{ x: 86, y: 142 }], face: 'up', sit: false, act: 'game' },
  { lane: 78, entry: [{ x: 276, y: 78 }, { x: 276, y: 60 }, { x: 280, y: 60 }], face: 'up', sit: false, act: 'coffee' },
  { lane: 82, entry: [{ x: 115, y: 82 }, { x: 115, y: 99 }], face: 'up', sit: true, act: 'tv' },
  { lane: 142, entry: [{ x: 304, y: 142 }, { x: 304, y: 118 }], face: 'left', sit: true, act: 'coffee' },
  { lane: 82, entry: [{ x: 146, y: 82 }, { x: 146, y: 75 }], face: 'up', sit: true, act: 'music' },
  { lane: 78, entry: [{ x: 290, y: 78 }, { x: 290, y: 88 }, { x: 295, y: 88 }], face: 'right', sit: false, act: 'tea' },
  { lane: 142, entry: [{ x: 120, y: 142 }], face: 'up', sit: false, act: 'phone' },
  { lane: 142, entry: [{ x: 236, y: 142 }], face: 'down', sit: false, act: 'phone' },
] as Place[]).map(s => ({ ...s, owner: null }));

/** кофемашина и кулер с кипятком */
export const BREAK_SPOTS = [CHILL[5], CHILL[9]];
/** два табурета у круглого кофейного столика на кухне */
export const CAFE = [CHILL[2], CHILL[7]];

/** место у бордюра, где выходят из машины и ждут её */
export const curbPlace = (): Place => ({ lane: 142, entry: [{ x: 192, y: 142 }, { x: 192, y: 152 }, { x: 192, y: 166 }, { x: 192, y: 179 }], face: 'down', street: true });
export const spotOf = (p: Place): Pt => p.entry[p.entry.length - 1];

/** брифинг: ведущий стоит лицом к команде в проходе под вторым рядом столов */
export const BRIEF_SPOTS: Place[] = ([[210, 124, 'down'], [184, 137, 'up'], [236, 137, 'up'], [158, 133, 'right'], [262, 133, 'left']] as [number, number, Face][])
  .map(([x, y, face]) => ({ lane: 142, entry: [{ x, y: 142 }, { x, y }], face, sit: false, act: 'brief', owner: null }));

/** в какой части офиса место: болтают только те, кто в одной зоне */
export const zoneOfPlace = (p: Place) => (p.street || p.out ? 'street' : spotOf(p).x < V ? 'lounge' : spotOf(p).x < 268 ? 'desks' : 'kitchen');

/** лавочка справа на улице: туда выходит отдохнуть агент, которому нечего делать */
export const BENCH: Place = {
  lane: 142, entry: [{ x: 192, y: 142 }, { x: 192, y: 152 }, { x: 192, y: 166 }, { x: 192, y: 174 }, { x: 366, y: 174 }, { x: 366, y: 166 }],
  face: 'down', sit: true, act: 'bench', out: true, owner: null,
};

/** у двери встречают курьера с пиццей */
/** база робота-пылесоса у нижней стены: на ней он заряжается, а кот иногда спит прямо на пылесосе */
export const VACUUM_DOCK: Pt = { x: 249, y: 151 };

export const PIZZA_DOOR: Place = { lane: 142, entry: [{ x: 192, y: 142 }, { x: 192, y: 152 }, { x: 192, y: 159 }], face: 'down', sit: false, act: 'pizza', owner: null };

export const WINDOWS = [198, 230];
export const inWindow = (x: number, y: number) => y >= 26.5 && y < 41.5 && WINDOWS.some(wx => x >= wx + 0.5 && x < wx + 25.5);
export const inBuilding = (x: number, y: number) => x >= 71 && x < 313 && y >= 19 && y < 165;
export const inSign = (x: number, y: number) => x >= 145 && x < 239 && y >= 0 && y < 20;

/** фонари только во дворах по бокам: столбы не должны залезать на стену здания */
export const LAMPS = [12, 66, 320, 349];
export const TREES: [number, number, number][] = [[26, 26, 12], [54, 58, 9], [24, 82, 12], [356, 28, 12], [334, 72, 9], [362, 118, 12], [336, 150, 8], [104, 8, 6], [280, 8, 7]];
export const PUDDLES: [number, number, number][] = [[30, 177, 6], [118, 179, 4], [302, 175, 7], [88, 196, 9], [214, 206, 10], [334, 192, 7], [262, 178, 4]];
/** точечные лампы под вывеской (мелкие пиксели) */
export const SPOTS = [336, 368, 400, 432];
/** гирлянда на живой изгороди */
export const FAIRY: [number, number][] = [];
for (const [x0, x1] of [[154, 362], [406, 614]]) for (let x = x0 + 4; x < x1; x += 11) FAIRY.push([x, 327 + (x % 3)]);
