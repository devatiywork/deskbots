// Вкладки окна настроек. Каждая собирает карточки из строк настроек и фич.
import { useSettings } from '@/entities/settings';
import { CallErmiiButton } from '@/features/call-ermii';
import { SignEditor } from '@/features/edit-sign';
import { MonitorPicker } from '@/features/pick-monitors';
import { PlacePicker } from '@/features/pick-place';
import T from '@/shared/i18n/ru/settings.json';
import { Card, Row, Section } from '@/shared/ui';
import { NameRow, RangeRow, SelectRow, SwitchRow } from './rows';

export function ScreenSection() {
  return (
    <Section title={T.screen.title} lead={T.screen.lead}>
      <Card title={T.screen.monitors}><MonitorPicker /></Card>
      <Card>
        <SelectRow k="scale" label={T.screen.scale} hint={T.screen.scaleHint} options={T.screen.scaleOptions} />
        <SwitchRow k="oled" label={T.screen.oled} hint={T.screen.oledHint} />
        <SwitchRow k="paused" label={T.screen.paused} hint={T.screen.pausedHint} />
        <SwitchRow k="autostart" label={T.screen.autostart} />
      </Card>
    </Section>
  );
}

export function OfficeSection() {
  return (
    <Section title={T.office.title} lead={T.office.lead}>
      <Card title={T.office.sign}><SignEditor /></Card>
      <Card>
        <SelectRow k="season" label={T.office.season} options={T.office.seasonOptions} />
        <SelectRow k="weather" label={T.office.weather} hint={T.office.weatherHint} options={T.office.weatherOptions} />
        <SwitchRow k="sound" label={T.office.sound} hint={T.office.soundHint} />
        <RangeRow k="volume" label={T.office.volume} min={0} max={100} />
      </Card>
      <Card title={T.office.place}><PlacePicker /></Card>
      <Card title={T.office.panel}>
        <SelectRow k="panel" label={T.office.panelWhere} options={T.office.panelOptions} />
        <SelectRow k="panelsize" label={T.office.panelSize} options={T.office.panelSizeOptions} />
      </Card>
    </Section>
  );
}

export function AgentsSection() {
  return (
    <Section title={T.agents.title} lead={T.agents.lead}>
      <Card>
        <SwitchRow k="showclaude" label={T.agents.showclaude} />
        <SwitchRow k="showcodex" label={T.agents.showcodex} />
        <SwitchRow k="showgpt" label={T.agents.showgpt} />
        <SwitchRow k="showollama" label={T.agents.showollama} />
        <SwitchRow k="showother" label={T.agents.showother} hint={T.agents.showotherHint} />
      </Card>
    </Section>
  );
}

export function DaySection() {
  const D = T.day;
  return (
    <Section title={D.title} lead={D.lead}>
      <Card>
        <RangeRow k="afk" label={D.afk} hint={D.afkHint} min={0} max={60} unit={D.afkUnit} zero={T.common.never} />
        <SwitchRow k="lunchon" label={D.lunchon} />
        <RangeRow k="lunch" label={D.lunch} min={10} max={16} unit={D.hourUnit} />
        <RangeRow k="endday" label={D.endday} min={15} max={23} unit={D.hourUnit} />
        <SwitchRow k="sleepon" label={D.sleepon} />
        <RangeRow k="sleephour" label={D.sleephour} min={20} max={23} unit={D.hourUnit} />
      </Card>
    </Section>
  );
}

export function ModesSection() {
  return (
    <Section title={T.modes.title} lead={T.modes.lead}>
      <Card>
        <SwitchRow k="gamequiet" label={T.modes.gamequiet} hint={T.modes.gamequietHint} />
        <SwitchRow k="callmute" label={T.modes.callmute} hint={T.modes.callmuteHint} />
      </Card>
    </Section>
  );
}

export function ErmiiSection() {
  const { settings } = useSettings();
  const E = T.ermii;
  return (
    <Section title={E.title} lead={E.lead}>
      <Card>
        <SwitchRow k="ermii" label={E.mode} hint={E.modeHint} />
        <RangeRow k="visits" label={E.visits} hint={E.visitsHint} min={1} max={4} unit={E.visitsUnit} />
        <Row label={E.callNow} hint={E.callNowHint}><CallErmiiButton disabled={!settings?.ermii} /></Row>
      </Card>
      <Card title={E.who}>
        {E.people.map(p => <NameRow key={p.key} k={p.key as 'p1name' | 'p2name' | 'p3name'} label={p.label} hint={p.hint} />)}
        <Row label={E.namesNote} />
      </Card>
    </Section>
  );
}
