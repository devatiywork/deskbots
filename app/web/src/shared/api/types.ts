// Данные, которые приходят из приложения. Поля совпадают с Rust (src-tauri/src/settings.rs и office-core).

export interface Settings {
  monitors: string[];
  season: 'auto' | 'spring' | 'summer' | 'autumn' | 'winter';
  weather: 'real' | 'auto' | 'clear' | 'rain' | 'storm' | 'snow' | 'fog' | 'wind';
  sound: boolean;
  volume: number;
  latitude: number;
  longitude: number;
  panel: 'right' | 'left' | 'hidden';
  panelsize: 'normal' | 'big';
  showclaude: boolean;
  showcodex: boolean;
  showgpt: boolean;
  showollama: boolean;
  showother: boolean;
  afk: number;
  lunchon: boolean;
  lunch: number;
  endday: number;
  sleepon: boolean;
  sleephour: number;
  gamequiet: boolean;
  callmute: boolean;
  scale: 'fill' | 'crisp';
  oled: boolean;
  sign1: string;
  sign2: string;
  ermii: boolean;
  visits: number;
  p1name: string;
  p2name: string;
  p3name: string;
  autostart: boolean;
  paused: boolean;
}

export interface Monitor { id: string; name: string; x: number; y: number; w: number; h: number; primary: boolean }
export interface MonitorsInfo { list: Monitor[]; used: string[] }
export interface ScreenInfo { main: boolean; desk: boolean }

export interface DayStats { files: number; commands: number; commits: number; tokens: number }
export interface WeekDay { key?: string; dow: number; tokens: number; commits: number }
export interface ClaudeLimit { pct?: number | null; reset: number; tokens: number; limited?: number; reached?: boolean }
export interface CodexWindow { pct: number; reset: number }
export interface Limits { claude?: ClaudeLimit; codex?: { five?: CodexWindow; week?: CodexWindow } }
export interface PcStats { cpu: number; mem: number; gpu?: { load: number; temp: number } }

export interface AgentState {
  id: string;
  kind: string;
  name: string;
  status: 'working' | 'waiting' | 'idle';
  tool?: string;
  detail?: string;
  hooks?: boolean;
  subs?: number;
  since?: number;
}

export interface OfficeFx { n: number; type: string; agent?: string; id?: string }

export interface OfficeState {
  agents: AgentState[];
  scan?: boolean;
  error?: string;
  idleMs?: number;
  locked?: boolean;
  stats?: DayStats;
  week?: WeekDay[];
  limits?: Limits;
  pc?: PcStats;
  trophies?: string[];
  fx?: OfficeFx[];
  game?: boolean;
  mic?: boolean;
  [extra: string]: unknown;
}

export interface AppInfo {
  version: string;
  dataDir: string;
  server: { port: number; events: number; lastEventAt?: number } | null;
  error: string;
  hooks: { claude: boolean; codex: boolean; exe: string };
  wallpaper: { monitor: string; w: number; h: number; mode: string }[];
}
