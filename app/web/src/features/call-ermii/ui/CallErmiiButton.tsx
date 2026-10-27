// «Позвать» руководство Grand Ermii прямо сейчас: обои получают событие visit и вызывают лимузин.
import { useState } from 'react';
import { send } from '@/shared/api/tauri';
import T from '@/shared/i18n/ru/settings.json';
import { Button } from '@/shared/ui';

export function CallErmiiButton({ disabled }: { disabled: boolean }) {
  const [sent, setSent] = useState(false);
  const call = () => { void send('visit', null); setSent(true); setTimeout(() => setSent(false), 3000); };
  return <Button onClick={call} disabled={disabled}>{sent ? T.ermii.called : T.ermii.call}</Button>;
}
