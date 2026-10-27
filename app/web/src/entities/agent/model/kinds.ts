// Виды агентов: цвета головы, тела, антенны и глаз. Имена для табличек — в i18n/ru/agent.json.

export interface KindLook { head: string; body: string; acc: string; eye: string; tag?: string }

export const KIND: Record<string, KindLook> = {
  claude:       { head: '#e8956b', body: '#cf6f47', acc: '#ffe2cf', eye: '#fff4e6' },
  'claude-app': { head: '#f2c29e', body: '#b5653f', acc: '#fff1e4', eye: '#fff4e6' },
  codex:        { head: '#ececf2', body: '#2c2c38', acc: '#7fdcff', eye: '#7fdcff' },
  chatgpt:      { head: '#25c48a', body: '#0f7a52', acc: '#eafff5', eye: '#eafff5' },
  ollama:       { head: '#f6e7d2', body: '#25233a', acc: '#5b8cff', eye: '#1D1A33', tag: '#5b8cff' },   // лама в наушниках и чёрном худи
  // другие ИИ: обычные боты в цветах своего бренда
  gemini:       { head: '#8ab4f8', body: '#3c4fb0', acc: '#c58af9', eye: '#ffffff' },
  grok:         { head: '#d4d4da', body: '#16161a', acc: '#ffffff', eye: '#ffffff' },
  deepseek:     { head: '#6d8cf5', body: '#2b3f9e', acc: '#cfe0ff', eye: '#e8f0ff' },
  qwen:         { head: '#8b7cf6', body: '#4b3fb8', acc: '#e6e0ff', eye: '#ffffff' },
  mistral:      { head: '#ffaf3a', body: '#d9502a', acc: '#ffe08a', eye: '#fff1d0' },
  perplexity:   { head: '#5fc9c4', body: '#1f5f62', acc: '#d8fffb', eye: '#e9fffd' },
  copilot:      { head: '#7fb2ff', body: '#7a4fd6', acc: '#ffd36b', eye: '#ffffff' },
};

export const OTHER_AI = ['gemini', 'grok', 'deepseek', 'qwen', 'mistral', 'perplexity', 'copilot'];

/** Группа для диалогов: Claude и приложение Claude — один «Клод». */
export const GROUP: Record<string, string> = { claude: 'claude', 'claude-app': 'claude', chatgpt: 'gpt', codex: 'codex', ollama: 'ollama' };
for (const k of OTHER_AI) GROUP[k] = k;
