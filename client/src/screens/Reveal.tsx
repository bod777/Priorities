import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';

export function Reveal() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, turnResult, playerId } = state;
  const [revealedCount, setRevealedCount] = useState(0);

  if (!lobbyState || !turnResult || !playerId) return null;

  const totalCards = turnResult.trueRanking.length;

  useEffect(() => {
    if (revealedCount < totalCards) {
      const timer = setTimeout(() => {
        setRevealedCount((prev) => prev + 1);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [revealedCount, totalCards]);

  const handleNextRound = () => {
    if (!socket) return;
    socket.emit('next-turn');
  };

  const handleSkip = () => {
    setRevealedCount(totalCards);
  };

  const isHost = lobbyState.hostId === playerId;
  const ranker = lobbyState.players.find((p) => p.id === turnResult.rankerId);

  const sortedScores = Object.entries(turnResult.totalScores)
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);

  // Reveal rank 1 first, ending at rank 5
  const orderedTrue = turnResult.trueRanking;
  const orderedGuess = turnResult.collectiveGuess ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-purple-600">Round Results</h1>
              <p className="text-gray-500 mt-1">
              Turn {lobbyState.currentTurn} of {lobbyState.totalTurns}
              <span className="ml-2">· Round {Math.ceil(lobbyState.currentTurn / lobbyState.rankerOrder.length)} of {Math.ceil(lobbyState.totalTurns / lobbyState.rankerOrder.length)}</span>
            </p>
            </div>
            {revealedCount < totalCards && (
              <button
                onClick={handleSkip}
                className="text-sm text-purple-600 hover:text-purple-700 underline"
              >
                Skip Animation
              </button>
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[2rem_1fr_2rem_1fr] gap-x-3 mb-2 px-1">
            <div />
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {ranker?.displayName}'s Ranking
            </p>
            <div />
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Your Collective Guess
            </p>
          </div>

          {/* Rows revealed rank 5 → rank 1 */}
          <div className="space-y-2 mb-8">
            {orderedTrue.map((trueCardId, index) => {
              const rank = index + 1;
              const isRevealed = index < revealedCount;
              const trueCard = lobbyState.cards.find((c) => c.id === trueCardId);
              const guessCardId = orderedGuess[index];
              const guessCard = lobbyState.cards.find((c) => c.id === guessCardId);
              const isMatch = trueCardId === guessCardId;

              return (
                <div
                  key={index}
                  className={`transition-all duration-500 ${
                    isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                  }`}
                >
                  {isRevealed && (
                    <div className="grid grid-cols-[2rem_1fr_2rem_1fr] gap-x-3 items-center">
                      {/* Rank badge */}
                      <div className="flex items-center justify-center">
                        <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                          {rank}
                        </div>
                      </div>

                      {/* Ranker's card */}
                      <div className="border-2 border-purple-200 rounded-lg p-3 bg-purple-50">
                        <p className="text-gray-800 text-sm">{trueCard?.text}</p>
                      </div>

                      {/* Match indicator */}
                      <div className="flex items-center justify-center text-lg">
                        {isMatch ? '✓' : '✗'}
                      </div>

                      {/* Collective guess card */}
                      <div className={`border-2 rounded-lg p-3 ${
                        isMatch
                          ? 'border-green-400 bg-green-50'
                          : 'border-red-300 bg-red-50'
                      }`}>
                        <p className="text-gray-800 text-sm">{guessCard?.text}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scores */}
          {revealedCount >= totalCards && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Total Scores</h2>
              <div className="space-y-2">
                {sortedScores.map((entry, index) => {
                  const player = lobbyState.players.find((p) => p.id === entry.id);
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-gray-400">#{index + 1}</span>
                        <span className="font-medium">{player?.displayName}</span>
                      </div>
                      <span className="text-lg font-bold text-purple-600">{entry.score} pts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {revealedCount >= totalCards && (
            <>
              {isHost ? (
                <button
                  onClick={handleNextRound}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  {lobbyState.currentTurn < lobbyState.totalTurns ? 'Next Turn' : 'View Final Results'}
                </button>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-center">Waiting for host to continue...</p>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
