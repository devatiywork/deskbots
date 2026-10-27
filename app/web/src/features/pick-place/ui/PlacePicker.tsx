// Место для восхода, заката, луны и реальной погоды: координаты вручную или быстрый выбор города.
import { useSettings } from '@/entities/settings';
import T from '@/shared/i18n/ru/settings.json';
import { Button, NumberField, Row } from '@/shared/ui';

export function PlacePicker() {
  const { settings, save } = useSettings();
  if (!settings) return null;
  return (
    <>
      <Row label={T.office.coords} hint={T.office.coordsHint}>
        <NumberField value={settings.latitude} min={-65} max={65} step={0.01} onCommit={v => save({ latitude: v })} />
        <NumberField value={settings.longitude} min={-180} max={180} step={0.01} onCommit={v => save({ longitude: v })} />
      </Row>
      <Row label={T.office.quickPick}>
        {T.office.places.map(p => <Button key={p.name} onClick={() => save({ latitude: p.lat, longitude: p.lon })}>{p.name}</Button>)}
      </Row>
    </>
  );
}
