// Все, кто говорит облачками: агенты, гости и руководство. Облачки соседей не должны налезать друг на друга,
// поэтому реплика сначала проверяет, кто рядом уже говорит. Агенты и люди регистрируют себя сами.

export interface Speech { text: string; until: number; at: number; talk?: boolean }
export interface Speaker {
  x: number; y: number;
  labelY?: number;
  say: Speech | null;
  arriving?: boolean;
  hidden?: boolean;
}

const sources: (() => Iterable<Speaker>)[] = [];
export const crowd = {
  add(src: () => Iterable<Speaker>) { sources.push(src); },
  *all(): Generator<Speaker> { for (const s of sources) yield* s(); },
};

/**
 * Кто сейчас ведёт разговор, а кому слово не давать: фичи выставляют, реплики агентов учитывают.
 * cafeLine — идёт реплика из разговора за столиком или брифинга (важнее чужой болтовни);
 * talkWho — пара, у которой сейчас диалог; briefTalking — на брифинге говорят по очереди.
 */
export const speech = {
  cafeLine: false,
  talkWho: null as Speaker[] | null,
  briefTalking: false,
};
