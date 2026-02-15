import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { Card } from '../components/Card.tsx';

export function Reveal() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, roundResult, playerId } = state;
  const [revealedCount, setRevealedCount] = useState(0);

  if (!lobbyState || !roundResult || !playerId) return null;

  const totalCards = roundResult.trueRanking.length;

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
    socket.emit('next-round');
  };

  const handleSkip = () => {
    setRevealedCount(totalCards);
  };

  const isHost = lobbyState.hostId === playerId;
  const ranker = lobbyState.players.find((p) => p.id === roundResult.rankerId);

  const sortedScores = Object.entries(roundResult.scores)
    .map(([playerId, score]) => ({ playerId, score }))
    .sort((a, b) => b.score - a.score);

  const reversedRanking = [...roundResult.trueRanking].reverse();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8 animate-fadeIn">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-purple-600">Round Results</h1>
            <p className="text-gray-600 mt-2">
              Round {lobbyState.currentRound} of {lobbyState.totalRounds}
            </p>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {ranker?.displayName}'s Ranking
              </h2>
              {revealedCount < totalCards && (
                <button
                  onClick={handleSkip}
                  className="text-sm text-purple-600 hover:text-purple-700 underline"
                >
                  Skip Animation
                </button>
              )}
            </div>
            <div className="space-y-3">
              {reversedRanking.map((cardId, reverseIndex) => {
                const actualIndex = totalCards - 1 - reverseIndex;
                const card = lobbyState.cards.find((c) => c.id === cardId);
                if (!card) return null;

                const isRevealed = reverseIndex < revealedCount;

                return (
                  <div
                    key={cardId}
                    className={`transition-all duration-500 ${
                      isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                    }`}
                    style={{ animationDelay: `${reverseIndex * 100}ms` }}
                  >
                    {isRevealed && <Card text={card.text} rank={actualIndex + 1} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Scores</h2>
            <div className="space-y-2">
              {sortedScores.map((entry, index) => {
                const player = lobbyState.players.find((p) => p.id === entry.playerId);
                return (
                  <div
                    key={entry.playerId}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                      <span className="font-medium">{player?.displayName}</span>
                    </div>
                    <span className="text-xl font-bold text-purple-600">
                      {entry.score} pts
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {roundResult.authorshipScore !== undefined && (
            <div className="mb-8">
              <h3 className="font-semibold mb-3">Authorship Guesses</h3>
              <p className="text-gray-700">
                Average authorship score: {roundResult.authorshipScore} points
              </p>
            </div>
          )}

          {revealedCount >= totalCards && (
            <>
              {isHost && (
                <button
                  onClick={handleNextRound}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  {lobbyState.currentRound < lobbyState.totalRounds ? 'Next Round' : 'View Final Results'}
                </button>
              )}

              {!isHost && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 text-center">
                    Waiting for host to continue...
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
