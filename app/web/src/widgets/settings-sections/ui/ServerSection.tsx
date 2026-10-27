// Сервер офиса и хуки: работает ли, сколько событий пришло, где данные, стоят ли хуки.
import { useAppInfo } from '@/entities/office';
import { HookActions } from '@/features/manage-hooks';
import { fill } from '@/shared/i18n';
import T from '@/shared/i18n/ru/settings.json';
import { hm } from '@/shared/lib/format';
import { Card, Row, Section, Status, Value } from '@/shared/ui';
import s from './ServerSection.module.scss';

const V = T.server;

export function ServerSection() {
  const [info, reload] = useAppInfo(true);
  const sv = info?.server;
  return (
    <Section title={V.title} lead={V.lead}>
      <Card>
        <Row label={V.server}>
          {info && <Status kind={info.error ? 'bad' : sv ? 'ok' : 'warn'}>{info.error || (sv ? fill(V.running, { port: sv.port }) : V.stopped)}</Status>}
        </Row>
        <Row label={V.events}>
          <Value>{sv ? `${sv.events}${sv.lastEventAt ? fill(V.lastAt, { time: hm(sv.lastEventAt) }) : ''}` : '—'}</Value>
        </Row>
        <Row label={V.dataDir}><span className={s.mono}>{info?.dataDir}</span></Row>
      </Card>
      <Card>
        <Row label={V.claudeHooks} hint={V.claudeHooksHint}>
          {info && <Status kind={info.hooks.claude ? 'ok' : 'warn'}>{info.hooks.claude ? V.installed : V.notInstalled}</Status>}
        </Row>
        <Row label={V.codexHooks} hint={V.codexHooksHint}>
          {info && <Status kind={info.hooks.codex ? 'ok' : 'warn'}>{info.hooks.codex ? V.installed : V.codexMissing}</Status>}
        </Row>
        <HookActions onDone={reload} />
      </Card>
    </Section>
  );
}
