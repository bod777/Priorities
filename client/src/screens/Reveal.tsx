import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { GameHeader } from '../components/GameHeader.tsx';

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
  const rankerName = turnResult.playerNames[turnResult.rankerId] ?? lobbyState.players.find((p) => p.id === turnResult.rankerId)?.displayName ?? turnResult.rankerId;

  const sortedScores = Object.entries(turnResult.totalScores)
    .map(([id, score]) => ({ id, score, name: turnResult.playerNames[id] ?? lobbyState.players.find((p) => p.id === id)?.displayName ?? id }))
    .sort((a, b) => b.score - a.score);

  // Reveal rank 1 first, ending at rank 5
  const orderedTrue = turnResult.trueRanking;
  const orderedGuess = turnResult.collectiveGuess ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <GameHeader
          title="Round Results"
          currentTurn={lobbyState.currentTurn}
          totalTurns={lobbyState.totalTurns}
          rankerOrder={lobbyState.rankerOrder}
        />
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {revealedCount < totalCards && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleSkip}
                className="text-sm text-purple-600 hover:text-purple-700 underline"
              >
                Skip Animation
              </button>
            </div>
          )}

          {/* Column headers */}
          <div className="grid grid-cols-[2rem_1fr_2rem_1fr] gap-x-3 mb-2 px-1">
            <div />
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {rankerName}'s Ranking
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
          {revealedCount >= totalCards && turnResult.authorshipResults && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-1">Authorship Guesses</h2>
              <p className="text-sm text-gray-500 mb-3">
                {rankerName} scored <span className="font-bold text-purple-600">{turnResult.authorshipScore} / {turnResult.cards.length}</span> correct
              </p>
              <div className="space-y-2">
                {turnResult.cards.map((card) => {
                  const trueAuthorId = turnResult.authorshipResults![card.id];
                  const guessedAuthorId = turnResult.authorshipGuesses?.[card.id];
                  const isCorrect = trueAuthorId === guessedAuthorId;
                  const getName = (id: string) =>
                    id === 'auto' ? 'Auto (generated)' : (turnResult.playerNames[id] ?? id);
                  const trueAuthorName = getName(trueAuthorId);
                  const guessedName = guessedAuthorId ? getName(guessedAuthorId) : '—';
                  return (
                    <div key={card.id} className={`rounded-lg p-3 border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-sm font-medium text-gray-800 mb-1">{card.text}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Guessed:</span>
                        <span className="font-medium">{guessedName}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500">Actually:</span>
                        <span className="font-medium">{trueAuthorName}</span>
                        <span className="ml-auto text-base">{isCorrect ? '✓' : '✗'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {revealedCount >= totalCards && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Total Scores</h2>
              <div className="space-y-2">
                {sortedScores.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-gray-400">#{index + 1}</span>
                      <span className="font-medium">{entry.name}</span>
                    </div>
                    <span className="text-lg font-bold text-purple-600">{entry.score} pts</span>
                  </div>
                ))}
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
