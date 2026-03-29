import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { RankingBoard } from '../components/RankingBoard.tsx';

export function Ranking() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  const [ranking, setRanking] = useState<string[]>([]);

  if (!lobbyState || !playerId) return null;

  const isRanker = lobbyState.currentRankerId === playerId;
  const hasSubmitted = lobbyState.submittedPlayerIds.includes(playerId);

  if (ranking.length === 0 && lobbyState.cards.length > 0) {
    setRanking(lobbyState.cards.map((c) => c.id));
  }

  const handleSubmit = () => {
    if (!socket || !isRanker) return;
    socket.emit('submit-ranking', { ranking });
  };

  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-purple-600">Ranking Phase</h1>
            <p className="text-gray-600 mt-2">
              Turn {lobbyState.currentTurn} of {lobbyState.totalTurns}
              <span className="text-gray-400 ml-2">
                · Round {Math.ceil(lobbyState.currentTurn / lobbyState.rankerOrder.length)} of {Math.ceil(lobbyState.totalTurns / lobbyState.rankerOrder.length)}
              </span>
            </p>
          </div>

          {isRanker && !hasSubmitted ? (
            <div className="space-y-4">
              <p className="text-gray-700">
                Drag and drop the cards to rank them from most to least preferred.
              </p>

              <RankingBoard
                cards={lobbyState.cards}
                ranking={ranking}
                onRankingChange={setRanking}
              />

              <button
                onClick={handleSubmit}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Submit Ranking
              </button>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-blue-800 text-center font-medium">
                {isRanker
                  ? 'Ranking submitted! Waiting for other players...'
                  : `Waiting for ${ranker?.displayName} to rank the cards...`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
