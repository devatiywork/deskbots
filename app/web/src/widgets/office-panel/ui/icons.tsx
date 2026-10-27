// Пиксельные значки панели 5×5 (# — основной цвет, o — второй) и мини-голова агента 6×7.

interface Icon5 { rows: string[]; col: string; col2?: string }

export const ICON5: Record<string, Icon5> = {
  spring: { rows: ['..#..', '.#.#.', '#.o.#', '.#.#.', '..#..'], col: '#ff9ab8', col2: '#ffcf5c' },
  summer: { rows: ['.###.', '#####', '.###.', '..o..', '..o..'], col: '#58b86a', col2: '#c9925f' },
  autumn: { rows: ['..#..', '.###.', '#####', '.###.', '..o..'], col: '#ff9a4a', col2: '#c9925f' },
  winter: { rows: ['#.#.#', '..#..', '#####', '..#..', '#.#.#'], col: '#9cd8ff' },
  clear: { rows: ['#...#', '.###.', '.###.', '.###.', '#...#'], col: '#ffcf5c' },
  rain: { rows: ['.###.', '#####', '.....', 'o.o.o', '.o.o.'], col: '#c9c3e6', col2: '#7fb4ff' },
  storm: { rows: ['.###.', '#####', '..o..', '.oo..', '..o..'], col: '#9a92c4', col2: '#ffcf5c' },
  snow: { rows: ['#.#.#', '..#..', '#####', '..#..', '#.#.#'], col: '#e0f2ff' },
  fog: { rows: ['####.', '.....', '.####', '.....', '####.'], col: '#b9b2d6' },
  wind: { rows: ['####.', '....#', '###..', '.....', '#####'], col: '#a8e4ff' },
  soundOn: { rows: ['..#..', '.##.o', '###.o', '.##.o', '..#..'], col: '#E0DAFA', col2: '#7fe0b4' },
  soundOff: { rows: ['..#..', '.##..', '###.o', '.##..', '..#..'], col: '#6a628f', col2: '#ff5c5c' },
  pizza: { rows: ['.###.', '#o#o#', '##o##', '#o#o#', '.###.'], col: '#ffcf5c', col2: '#e0453c' },
  demoOn: { rows: ['..#..', '#####', '#o#o#', '#####', '.#.#.'], col: '#b9a8ff', col2: '#7fe0b4' },
  demoOff: { rows: ['..#..', '#####', '#o#o#', '#####', '.#.#.'], col: '#6a628f', col2: '#3a3552' },
};

export function PixIcon({ name, u }: { name: string; u: number }) {
  const ic = ICON5[name];
  if (!ic) return null;
  return (
    <svg width={5 * u} height={5 * u} viewBox="0 0 5 5" shapeRendering="crispEdges" style={{ flex: 'none' }}>
      {ic.rows.flatMap((row, y) => [...row].map((ch, x) => (ch === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={ch === 'o' ? ic.col2 : ic.col} />)))}
    </svg>
  );
}

/** Голова агента в пикселях: лама Ollama с ушами и синими наушниками, остальные — боты с экраном-лицом. */
export function MiniHead({ kind, head, body, eye, waiting, u }: { kind: string; head: string; body: string; eye: string; waiting: boolean; u: number }) {
  const llama = kind === 'ollama';
  return (
    <svg width={8 * u} height={9 * u} viewBox="-1 -2 8 9" shapeRendering="crispEdges" style={{ flex: 'none' }}>
      <rect x={0} y={0} width={6} height={5} fill={head} />
      {llama ? (
        <>
          <rect x={0} y={-2} width={1} height={2} fill={head} /><rect x={5} y={-2} width={1} height={2} fill={head} />
          <rect x={-1} y={1} width={1} height={3} fill="#5b8cff" /><rect x={6} y={1} width={1} height={3} fill="#5b8cff" />
          <rect x={1} y={2} width={1} height={1} fill="#1D1A33" /><rect x={4} y={2} width={1} height={1} fill="#1D1A33" />
        </>
      ) : (
        <>
          <rect x={1} y={2} width={4} height={2} fill="#1D1A33" />
          <rect x={2} y={2} width={1} height={1} fill={waiting ? '#ffcf5c' : eye} /><rect x={4} y={2} width={1} height={1} fill={waiting ? '#ffcf5c' : eye} />
        </>
      )}
      <rect x={0} y={5} width={6} height={2} fill={body} />
    </svg>
  );
}
