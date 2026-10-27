// Статистика: сводка дня, токены за неделю, лимиты и нагрузка ПК, кубки — то же, что на доске, билборде и в шкафу.
import type { ReactNode } from 'react';
import { useOfficeState } from '@/entities/office';
import { Cup, TROPHY_IDS } from '@/entities/trophy';
import type { OfficeState } from '@/shared/api/types';
import { fill } from '@/shared/i18n';
import T from '@/shared/i18n/ru/settings.json';
import { fmtBig, hm } from '@/shared/lib/format';
import { Bar, Card, Section, Value } from '@/shared/ui';
import s from './StatsSection.module.scss';

const S = T.stats;

function limitRows(st: OfficeState): [string, ReactNode, string][] {
  const c = st.limits?.claude, x = st.limits?.codex, p = st.pc, now = Date.now(), rows: [string, ReactNode, string][] = [];
  if (p) {
    rows.push([S.cpu, <Bar pct={p.cpu} />, `${p.cpu}%`]);
    rows.push([S.gpu, <Bar pct={p.gpu?.load ?? 0} />, p.gpu ? `${p.gpu.load}% · ${Math.round(p.gpu.temp)}°` : '—']);
    rows.push([S.mem, <Bar pct={p.mem} />, `${p.mem}%`]);
  }
  if (c) {
    // без процента от Claude полоска показывает, сколько прошло из окна 5 часов
    const bar = c.limited ? <Bar pct={100} color="#ff5c5c" /> : <Bar pct={c.pct ?? (c.reset > now ? 100 - (c.reset - now) / 18e4 : 0)} color={c.pct == null ? '#7d6ef0' : undefined} />;
    const val = c.limited ? (c.limited > 0 ? fill(S.limitUntil, { time: hm(c.limited) }) : S.limit)
      : c.reset > now ? (c.pct != null ? `${c.pct}% · ` : fill(S.tokensShort, { n: fmtBig(c.tokens) })) + fill(S.resetAt, { time: hm(c.reset) })
      : S.notStarted;
    rows.push([S.claude5, bar, val]);
  }
  if (x) {
    const p5 = x.five && x.five.reset > now ? x.five.pct : 0, pw = x.week && x.week.reset > now ? x.week.pct : 0;
    rows.push([S.codex5, <Bar pct={p5} />, `${p5}%`], [S.codexWeek, <Bar pct={pw} />, `${pw}%`]);
  }
  return rows;
}

export function StatsSection() {
  const st = useOfficeState(true);
  const ok = st && !st.error;
  const d = st?.stats, wk = st?.week ?? [], max = Math.max(1, ...wk.map(x => x.tokens));
  const got = new Set(st?.trophies ?? []);
  const rows = ok ? limitRows(st) : [];
  return (
    <Section title={S.title} lead={S.lead}>
      <Card title={S.today}>
        {ok ? (
          <div className={s.grid}>
            {([[S.files, d?.files], [S.commands, d?.commands], [S.commits, d?.commits], [S.tokens, d?.tokens != null ? fmtBig(d.tokens) : null]] as const).map(([n, v]) => (
              <div key={n} className={s.stat}><b className="px">{v ?? '—'}</b><span>{n}</span></div>
            ))}
          </div>
        ) : <div className={s.err}>{st?.error || T.common.noServer}</div>}
        <h2 className={`${s.sub} px`}>{S.week}</h2>
        <div className={s.week}>
          {wk.map((x, i) => (
            <div key={i} className={i === wk.length - 1 ? s.today : undefined} title={fill(S.weekTip, { tokens: fmtBig(x.tokens), commits: x.commits })}>
              <small>{x.tokens ? fmtBig(x.tokens) : ''}</small>
              <i style={{ height: `${Math.round((x.tokens / max) * 80)}%` }} />
              <small>{S.dow[x.dow]}</small>
            </div>
          ))}
        </div>
      </Card>
      <Card title={S.limits}>
        {rows.length ? rows.map(([n, bar, v]) => (
          <div key={n} className={s.limit}><span className={s.limitName}>{n}</span>{bar}<Value wide>{v}</Value></div>
        )) : <p className={s.none}>{T.common.noData}</p>}
      </Card>
      <Card title={S.trophies}>
        <div className={s.trophies}>{TROPHY_IDS.map(id => <Cup key={id} id={id} got={got.has(id)} />)}</div>
      </Card>
    </Section>
  );
}
