// Табло дня на доске задач: что сделали сегодня (сводка из логов от сервера);
// каждые 12 секунд доска показывает неделю — токены по дням, сегодня жёлтым.
import { Q, setTarget } from '@/shared/lib/pixel/canvas';
import { g } from '@/shared/lib/pixel/layers';
import { textQ, textW } from '@/shared/lib/pixel/font';
import { fmtBig } from '@/shared/lib/format';
import TXT from '@/shared/i18n/ru/scene.json';
import { now, server } from '@/entities/world';

export function drawBoard() {
  const { dayStats, weekData } = server;
  if (!dayStats) return;                             // без сервера на доске обычные стикеры
  setTarget(g);
  const B = TXT.board;
  Q(318, 54, 64, 27, '#fbfaff');
  if (weekData && weekData.some(d => d.tokens) && ((now() / 12) | 0) % 2 === 1) {
    const max = Math.max(1, ...weekData.map(d => d.tokens)), tot = fmtBig(weekData.reduce((s, d) => s + d.tokens, 0));
    textQ(B.week, 320, 55, 1, '#6a628f'); textQ(tot, 380 - textW(tot), 55, 1, '#1D1A33');
    weekData.forEach((d, i) => {
      const x = 322 + i * 8, bh = d.tokens ? Math.max(1, Math.round((d.tokens / max) * 12)) : 0;
      if (bh) Q(x, 74 - bh, 5, bh, i === 6 ? '#c99a1a' : '#b9a8ff');
      textQ(B.days[d.dow], x + 1, 76, 1, i === 6 ? '#1D1A33' : '#6a628f');
    });
    return;
  }
  const rows: [string, string | number, string][] = [
    [B.files, dayStats.files, '#cf6f47'], [B.commands, dayStats.commands, '#137A4F'],
    [B.commits, dayStats.commits, '#4A37C9'], [B.tokens, fmtBig(dayStats.tokens), '#c99a1a'],
  ];
  rows.forEach(([label, v, col], i) => {
    const y = 55 + i * 6, s = String(v);
    Q(320, y + 1, 3, 3, col); textQ(label, 325, y, 1, '#6a628f'); textQ(s, 380 - textW(s), y, 1, '#1D1A33');
  });
}
