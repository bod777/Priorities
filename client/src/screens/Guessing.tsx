import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { RankingBoard } from '../components/RankingBoard.tsx';

export function Guessing() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  const [guess, setGuess] = useState<string[]>(() =>
    lobbyState?.cards.map((c) => c.id) ?? []
  );

  if (!lobbyState || !playerId) return null;

  const isRanker = lobbyState.currentRankerId === playerId;
  const hasSubmitted = lobbyState.submittedPlayerIds.includes(playerId);

  const handleSubmit = () => {
    if (!socket || isRanker) return;
    socket.emit('submit-guess', { ranking: guess });
  };

  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-purple-600">Guessing Phase</h1>
            <p className="text-gray-600 mt-2">
              Round {lobbyState.currentRound} of {lobbyState.totalRounds}
            </p>
          </div>

          {!isRanker && !hasSubmitted ? (
            <div className="space-y-4">
              <p className="text-gray-700">
                Try to guess how {ranker?.displayName} ranked these cards!
              </p>

              <RankingBoard
                cards={lobbyState.cards}
                ranking={guess}
                onRankingChange={setGuess}
              />

              <button
                onClick={handleSubmit}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Submit Guess
              </button>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-blue-800 text-center font-medium">
                {isRanker
                  ? 'Waiting for other players to guess your ranking...'
                  : 'Guess submitted! Waiting for other players...'}
              </p>
              <p className="text-blue-600 text-center mt-2">
                {lobbyState.submittedPlayerIds.length} /{' '}
                {lobbyState.players.filter((p) => p.id !== lobbyState.currentRankerId).length}{' '}
                players ready
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
