// Надпись на вывеске: две строки, только знаки пиксельного шрифта, заглавными.
import { useSettings } from '@/entities/settings';
import T from '@/shared/i18n/ru/settings.json';
import { Button, Row, TextField } from '@/shared/ui';

export const SIGN_DEFAULT = { sign1: 'DESKBOTS', sign2: 'AI OFFICE' } as const;
const cleanSign = (v: string) => v.toUpperCase().replace(/[^A-ZА-ЯЁ0-9 .,!?:\-+/'"()#*_]/g, '');

export function SignEditor() {
  const { settings, save } = useSettings();
  if (!settings) return null;
  return (
    <>
      <Row label={T.office.sign1} hint={T.office.sign1Hint} htmlFor="sign1">
        <TextField id="sign1" upper maxLength={24} clean={cleanSign} value={settings.sign1} onCommit={v => save({ sign1: v })} />
      </Row>
      <Row label={T.office.sign2} hint={T.office.sign2Hint} htmlFor="sign2">
        <TextField id="sign2" upper maxLength={24} clean={cleanSign} value={settings.sign2} onCommit={v => save({ sign2: v })} />
      </Row>
      <Row label={T.office.signSave}>
        <Button onClick={() => save(SIGN_DEFAULT)}>{T.office.signReset}</Button>
      </Row>
    </>
  );
}
