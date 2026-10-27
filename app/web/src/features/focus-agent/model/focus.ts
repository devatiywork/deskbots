// Клик по агенту (на сцене или в панели): окно его программы выходит вперёд, агент отвечает облачком.
import { agents, say, type Agent } from '@/entities/agent';
import { now, server } from '@/entities/world';
import { api } from '@/shared/api/tauri';
import { DEMO } from '@/shared/lib/flags';
import { pick } from '@/shared/i18n';
import P from '@/shared/i18n/ru/panel.json';

export async function focusAgent(a: Agent) {
  if (!server.online || DEMO || a.id.startsWith('demo')) { say(a, P.focus.demo, now(), true); return; }
  try {
    const { result } = await api.focus(a.id);
    const t = now();
    if (!agents.has(a.id)) return;
    if (result === 'denied') say(a, P.focus.denied, t, true);
    else if (result === 'none' || result === 'unknown') say(a, pick(P.focus.hidden), t, true);
    else if (result !== 'error') say(a, pick(P.focus.ok), t, true);
  } catch { /* программа не ответила */ }
}
