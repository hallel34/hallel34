import { useMemo, useState } from 'react';
import type { GameConfig } from './types';
import { loadConfig, saveConfig } from './store';
import Home from './components/Home';
import Creator from './components/Creator';
import Player from './components/Player';

type Screen = 'home' | 'creator' | 'player';

export default function App() {
  const initial = useMemo(() => {
    const { config, source } = loadConfig();
    if (source === 'hash') saveConfig(config);
    return { config, source };
  }, []);
  const [config, setConfig] = useState<GameConfig>(initial.config);
  const [screen, setScreen] = useState<Screen>('home');
  const isDemo = initial.source === 'demo';

  const handleSave = (c: GameConfig) => { saveConfig(c); setConfig(c); };
  const handlePlayFromCreator = (c: GameConfig) => { saveConfig(c); setConfig(c); setScreen('player'); };

  return (
    <div className="app-shell">
      {screen === 'home' && (
        <Home config={config} isDemo={isDemo} onCreate={() => setScreen('creator')} onPlay={() => setScreen('player')} />
      )}
      {screen === 'creator' && (
        <Creator initial={config} onSave={handleSave} onPlay={handlePlayFromCreator} onBack={() => setScreen('home')} />
      )}
      {screen === 'player' && (
        <Player config={config} onBack={() => setScreen('home')} />
      )}
    </div>
  );
}
