import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { startBattle, newSeed } from './battle/store.ts';
import { readDevParams } from './dev.ts';
import { pickLocale, translator } from './i18n.ts';
import './style.css';
import { TextContext } from './text.tsx';
import { applyPalette, loadFont } from './theme.ts';

const DEFAULT_FIXTURE = 'riff';

async function start(): Promise<void> {
  applyPalette();
  await loadFont();
  const params = readDevParams();
  if (params.scene !== null && params.scene !== 'battle') console.warn(`Unknown scene '${params.scene}': opening the battle.`);
  const locale = pickLocale(params.lang);
  document.documentElement.lang = locale;
  startBattle(params.fixture ?? DEFAULT_FIXTURE, params.seed ?? newSeed());
  const root = document.getElementById('root');
  if (!root) throw new Error('no #root element');
  createRoot(root).render(
    <TextContext value={translator(locale)}>
      <App />
    </TextContext>,
  );
}

void start();
