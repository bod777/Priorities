import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { RankingBoard } from '../components/RankingBoard.tsx';

export function PersonalRanking() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  const [ranking, setRanking] = useState<string[]>([]);

  if (!lobbyState || !playerId) return null;

  const hasSubmitted = lobbyState.submittedPlayerIds.includes(playerId);

  if (ranking.length === 0 && lobbyState.cards.length > 0) {
    setRanking(lobbyState.cards.map((c) => c.id));
  }

  const handleSubmit = () => {
    if (!socket) return;
    socket.emit('submit-personal-ranking', { ranking });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-purple-600">Personal Ranking</h1>
            <p className="text-gray-600 mt-2">
              Round {lobbyState.currentRound} of {lobbyState.totalRounds}
            </p>
          </div>

          {!hasSubmitted ? (
            <div className="space-y-4">
              <p className="text-gray-700">
                How would you rank these cards?
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
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <p className="text-green-800 text-center font-medium">
                Ranking submitted! Waiting for other players...
              </p>
              <p className="text-green-600 text-center mt-2">
                {lobbyState.submittedPlayerIds.length} / {lobbyState.players.length} players ready
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
