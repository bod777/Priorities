import { useState } from 'react';
import { useGame } from '../context/GameContext.tsx';
import { PlayerSidebar } from './PlayerSidebar.tsx';

interface GameHeaderProps {
  title: string;
  currentTurn: number;
  totalTurns: number;
  rankerOrder: string[];
}

export function GameHeader({ title, currentTurn, totalTurns, rankerOrder }: GameHeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state } = useGame();
  const { playerId, lobbyState } = state;
  const me = lobbyState?.players.find((p) => p.id === playerId);

  const totalRounds = Math.ceil(totalTurns / rankerOrder.length);
  const currentRound = Math.ceil(currentTurn / rankerOrder.length);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-purple-600">{title}</h1>
            <p className="text-gray-600 mt-1">
              Turn {currentTurn} of {totalTurns}
              <span className="text-gray-400 ml-2">
                · Round {currentRound} of {totalRounds}
              </span>
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors rounded-lg px-3 py-2"
          >
            <span className="text-sm font-bold text-gray-700 tracking-wide">
              {me?.displayName ?? 'PLAYERS'}
            </span>
            <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
          </button>
        </div>
      </div>
      <PlayerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
