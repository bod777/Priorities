import { useGame } from '../context/GameContext.tsx';
import { useSocket } from '../hooks/useSocket.ts';

export function GameOver() {
  const { state } = useGame();
  const { socket } = useSocket();
  const { gameOverData, lobbyState, playerId } = state;

  if (!gameOverData || !lobbyState) return null;

  const isHost = lobbyState.hostId === playerId;

  const sortedFinalScores = Object.entries(gameOverData.finalScores)
    .map(([playerId, totalScore]) => ({ playerId, totalScore }))
    .sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 animate-fadeIn">
          <h1 className="text-4xl font-bold text-center text-purple-600 mb-8">Game Over!</h1>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-center">Final Scores</h2>
            <div className="space-y-3">
              {sortedFinalScores.map((entry, index) => {
                const player = lobbyState.players.find((p) => p.id === entry.playerId);
                return (
                  <div
                    key={entry.playerId}
                    className={`flex items-center justify-between p-6 rounded-lg ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-200 border-4 border-yellow-500'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-400 to-gray-200 border-2 border-gray-500'
                        : index === 2
                        ? 'bg-gradient-to-r from-orange-400 to-orange-200 border-2 border-orange-500'
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-bold">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </span>
                      <span className="text-xl font-medium">{player?.displayName}</span>
                    </div>
                    <span className="text-2xl font-bold text-purple-600">
                      {entry.totalScore} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-center">Superlatives</h2>

            {gameOverData.superlatives.mostPredictable && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">
                  🎯 Most Predictable Ranker
                </h3>
                <p className="text-purple-800">
                  {lobbyState.players.find((p) => p.id === gameOverData.superlatives.mostPredictable?.playerId)?.displayName}
                </p>
                <p className="text-sm text-purple-600 mt-1">
                  Average score from guessers: {gameOverData.superlatives.mostPredictable?.avgScore.toFixed(1)} pts
                </p>
              </div>
            )}

            {gameOverData.superlatives.leastPredictable && (
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-pink-900 mb-2">
                  🎲 Least Predictable Ranker
                </h3>
                <p className="text-pink-800">
                  {lobbyState.players.find((p) => p.id === gameOverData.superlatives.leastPredictable?.playerId)?.displayName}
                </p>
                <p className="text-sm text-pink-600 mt-1">
                  Average score from guessers: {gameOverData.superlatives.leastPredictable?.avgScore.toFixed(1)} pts
                </p>
              </div>
            )}

            {gameOverData.superlatives.bestGuesser && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  🧠 Best Guesser
                </h3>
                <p className="text-green-800">
                  {lobbyState.players.find((p) => p.id === gameOverData.superlatives.bestGuesser?.playerId)?.displayName}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Total guessing score: {gameOverData.superlatives.bestGuesser?.totalScore} pts
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            {isHost ? (
              <button
                onClick={() => socket?.emit('reset-game')}
                className="bg-purple-600 text-white py-3 px-8 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Play Again
              </button>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">Waiting for host to start a new game...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
