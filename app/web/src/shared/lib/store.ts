// Небольшое хранилище страницы (localStorage): выбранный сезон, автопогода, демо-режим.
// Может быть недоступно — тогда просто ничего не помнит.

export const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* без памяти */ } },
};
