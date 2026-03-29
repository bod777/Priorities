import { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext.tsx';

export function RoundTransition() {
  const { state } = useGame();
  const { lobbyState } = state;
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!lobbyState) return null;

  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full text-center">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-purple-600 mb-2">
            Turn {lobbyState.currentTurn}
          </h1>
          <p className="text-gray-500 text-lg">
            of {lobbyState.totalTurns}
            {' · '}Round {Math.ceil(lobbyState.currentTurn / lobbyState.rankerOrder.length)} of {Math.ceil(lobbyState.totalTurns / lobbyState.rankerOrder.length)}
          </p>
        </div>

        <div className="mb-8 py-8 px-6 bg-gradient-to-r from-yellow-100 to-yellow-50 rounded-xl border-2 border-yellow-400">
          <p className="text-gray-600 text-lg mb-3">The Ranker is</p>
          <h2 className="text-4xl font-bold text-purple-600">
            {ranker?.displayName || 'Unknown'}
          </h2>
        </div>

        {countdown > 0 ? (
          <div className="text-6xl font-bold text-purple-600 animate-pulse">
            {countdown}
          </div>
        ) : (
          <p className="text-gray-600 text-lg">Get ready...</p>
        )}
      </div>
    </div>
  );
}
