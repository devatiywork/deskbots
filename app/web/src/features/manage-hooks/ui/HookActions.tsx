// Переустановить или убрать хуки Claude Code и Codex; ответ приложения показывается под кнопками.
import { useState } from 'react';
import { api } from '@/shared/api/tauri';
import T from '@/shared/i18n/ru/settings.json';
import { Button, Row } from '@/shared/ui';
import s from './HookActions.module.scss';

export function HookActions({ onDone }: { onDone: () => void }) {
  const [msg, setMsg] = useState('');
  const run = async (fn: () => Promise<string[]>, empty: string) => {
    try { const m = await fn(); setMsg(m.length ? m.join('\n') : empty); } catch (e) { setMsg(String(e)); }
    onDone();
  };
  return (
    <>
      <Row label={T.server.reinstall} hint={T.server.reinstallHint}>
        <Button onClick={() => run(api.installHooks, T.server.alreadyIn)}>{T.server.reinstallBtn}</Button>
      </Row>
      <Row label={T.server.remove} hint={T.server.removeHint}>
        <Button onClick={() => run(api.removeHooks, T.server.alreadyOut)}>{T.server.removeBtn}</Button>
      </Row>
      {msg && <div className={s.msg}>{msg}</div>}
    </>
  );
}
