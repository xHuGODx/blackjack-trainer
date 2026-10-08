'use client';
import { useReducer, useState } from 'react';
import { initialState, reducer } from '@/lib/blackjack/state';
import { gameReducer, newGame } from '@/lib/blackjack/game';
import { DEFAULT_PREFERENCES } from './table-settings';
import { LiveDashboard } from './live-dashboard';
import { GameDashboard } from './game-dashboard';
export function Workbench() {
  const [mode, setMode] = useState<'play' | 'manual'>('play');
  const [manual, manualDispatch] = useReducer(reducer, undefined, () => initialState());
  const [game, gameDispatch] = useReducer(gameReducer, undefined, () => newGame());
  const [manualPrefs, setManualPrefs] = useState(DEFAULT_PREFERENCES);
  const [gamePrefs, setGamePrefs] = useState(DEFAULT_PREFERENCES);
  return mode === 'play'
    ? <GameDashboard game={game} dispatch={gameDispatch} prefs={gamePrefs} setPrefs={setGamePrefs} onManual={() => setMode('manual')} />
    : <LiveDashboard state={manual} dispatch={manualDispatch} prefs={manualPrefs} setPrefs={setManualPrefs} onPlay={() => setMode('play')} />;
}
