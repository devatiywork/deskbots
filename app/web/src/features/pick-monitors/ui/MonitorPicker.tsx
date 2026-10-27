// Мониторы с офисом: переключатель у каждого. Отмечены все — значит «на всех», и на подключённых потом тоже.
import { useEffect, useState } from 'react';
import { useSettings } from '@/entities/settings';
import { api } from '@/shared/api/tauri';
import type { MonitorsInfo } from '@/shared/api/types';
import { fill } from '@/shared/i18n';
import T from '@/shared/i18n/ru/settings.json';
import { Row, Switch } from '@/shared/ui';
import s from './MonitorPicker.module.scss';

export function MonitorPicker() {
  const { settings, save } = useSettings();
  const [info, setInfo] = useState<MonitorsInfo>({ list: [], used: [] });
  const [keepOne, setKeepOne] = useState(false);
  useEffect(() => {
    const load = () => api.monitors().then(setInfo).catch(() => {});
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);
  if (!settings) return null;

  const want = settings.monitors, all = !info.list.some(m => want.includes(m.id));
  const isOn = (id: string) => all || want.includes(id);
  const toggle = (id: string, v: boolean) => {
    const on = info.list.filter(m => (m.id === id ? v : isOn(m.id))).map(m => m.id);
    if (!on.length) { setKeepOne(true); return; }
    setKeepOne(false);
    void save({ monitors: on.length === info.list.length ? [] : on });
  };

  return (
    <>
      <p className={s.hint}>{keepOne ? T.screen.monitorsKeepOne : T.screen.monitorsHint}</p>
      {info.list.length ? info.list.map(m => (
        <Row key={m.id} label={fill(T.screen.monitor, { name: m.name, w: m.w, h: m.h }) + (m.primary ? T.screen.primary : '')}
          hint={info.used.includes(m.id) ? T.screen.here : T.screen.notHere}>
          <Switch checked={isOn(m.id)} onChange={v => toggle(m.id, v)} />
        </Row>
      )) : <p className={s.hint}>{T.screen.monitorsNone}</p>}
    </>
  );
}
