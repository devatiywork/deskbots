// Панель на обоях: шапка с часами, кто в офисе и чем занят, подсказка, сводка дня, восход и закат,
// кнопки сезона, погоды, звука, пиццы и демо. Мышь сюда пересылает приложение: элементы с data-hit
// получают подсветку (data-hover) и клики от страницы.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { getHud, hudActions as actions } from '../model/hud';
import type { ButtonKey, HudButton } from '../model/types';
import { MiniHead, PixIcon } from './icons';
import s from './OfficePanel.module.scss';

function PixelBox({ fill, edge, className, children, ...rest }: { fill: string; edge: string; className?: string; children?: ReactNode } & Record<string, unknown>) {
  return (
    <div className={`${s.box} ${className ?? ''}`} style={{ '--fill': fill, '--edge': edge } as CSSProperties} {...rest}>
      <div className={s.fill}>{children}</div>
    </div>
  );
}

// цвета кнопок: обычная, демо включено, демо выключено
const BTN = {
  normal: { fill: '#231e48', edge: '#4A37C9' },
  demoOn: { fill: '#17463a', edge: '#7fe0b4' },
  demoOff: { fill: '#1a1730', edge: '#4a4466' },
};

function Button({ b, u, onPress }: { b: HudButton; u: number; onPress: (k: ButtonKey) => void }) {
  const look = b.key === 'demo' ? (b.on ? BTN.demoOn : BTN.demoOff) : BTN.normal;
  const kind = b.key === 'demo' ? (b.on ? s.demoOn : s.demoOff) : '';
  return (
    <PixelBox fill={look.fill} edge={look.edge} className={`${s.btn} ${kind} ${b.half ? s.half : ''} ${b.compact ? s.compact : ''}`}
      data-hit="" onClick={() => onPress(b.key)}>
      <span className={s.btnInner}>
        <PixIcon name={b.icon} u={u} />
        <span className={s.btnText}>{b.text}</span>
        {!b.half && <span className={s.more}>›</span>}
      </span>
    </PixelBox>
  );
}

/** Ряды кнопок: две «половинки» встают рядом. */
function lines(btns: HudButton[]): HudButton[][] {
  const out: HudButton[][] = [];
  for (const b of btns) { const l = out.at(-1); if (b.half && l && l[0].half && l.length < 2) l.push(b); else out.push([b]); }
  return out;
}

export function OfficePanel() {
  const [hud, setHud] = useState(getHud);
  useEffect(() => { const id = setInterval(() => setHud(getHud()), 250); return () => clearInterval(id); }, []);
  if (hud.side === 'hidden') return null;
  const u = hud.big ? 3 : 2;
  const style = { '--u': `${u}px`, '--fs': `${hud.big ? 30 : 20}px`, opacity: hud.oled ? 0.78 : 0.94 } as CSSProperties;
  const buttons = (
    <div className={s.buttons}>
      {lines(hud.buttons).map((l, i) => <div key={i} className={s.btnRow}>{l.map(b => <Button key={b.key} b={b} u={u} onPress={actions.button} />)}</div>)}
    </div>
  );
  return (
    <div className={`${s.panel} ${hud.side === 'left' ? s.left : s.right} ${hud.big ? s.big : ''}`} style={style}>
      {hud.full ? (
        <PixelBox fill="#4A37C9" edge="rgba(74,55,201,0.35)" className={s.glow}>
          <PixelBox fill="#1D1A33" edge="#7d6ef0" className={s.body}>
            <PixelBox fill="#120f24" edge="#4A37C9" className={s.head}>
              <div className={s.headRow}>
                <span className={s.title}>{hud.title}</span>
                <span className={s.clock}>{hud.clock}{hud.tick ? ' ' : '·'}</span>
              </div>
            </PixelBox>
            <div className={s.rows}>
              {hud.rows.length ? hud.rows.map(r => (
                <div key={r.id} className={s.row} data-hit="" onClick={() => actions.row(r.id)}>
                  <MiniHead kind={r.kind} head={r.head} body={r.body} eye={r.eye} waiting={r.waiting} u={u} />
                  <div className={s.rowText}>
                    <div className={s.name}>{r.name}</div>
                    <div className={s.status} style={{ color: r.color }}>{r.status}</div>
                  </div>
                </div>
              )) : <div className={`${s.empty} ${hud.online ? '' : s.warn}`}>{hud.empty}</div>}
            </div>
            {hud.hint && <div className={s.hint}>{hud.hint}</div>}
            {hud.stats.map(t => <div key={t} className={s.stat}>{t}</div>)}
            <div className={s.sun}>{hud.sun}</div>
            {buttons}
          </PixelBox>
        </PixelBox>
      ) : buttons}
    </div>
  );
}
