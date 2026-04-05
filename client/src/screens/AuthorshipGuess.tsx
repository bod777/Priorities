import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { GameHeader } from '../components/GameHeader.tsx';

export function AuthorshipGuess() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;
  const [guesses, setGuesses] = useState<Record<string, string>>({});

  if (!lobbyState || !playerId) return null;

  const isRanker = lobbyState.currentRankerId === playerId;
  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);
  const nonRankers = lobbyState.players.filter((p) => p.id !== lobbyState.currentRankerId);

  // Options: each non-ranker player + 'auto' for auto-generated cards
  const options = [
    ...nonRankers.map((p) => ({ value: p.id, label: p.displayName })),
    { value: 'auto', label: 'Auto (generated)' },
  ];

  const allGuessed = lobbyState.cards.length > 0 &&
    lobbyState.cards.every((card) => guesses[card.id]);

  const handleSubmit = () => {
    if (!socket || !allGuessed) return;
    socket.emit('submit-authorship', { guesses });
  };

  const setGuess = (cardId: string, value: string) => {
    setGuesses((prev) => ({ ...prev, [cardId]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <GameHeader
          title="Authorship Guess"
          currentTurn={lobbyState.currentTurn}
          totalTurns={lobbyState.totalTurns}
          rankerOrder={lobbyState.rankerOrder}
        />

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {isRanker ? (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-900 font-medium">
                  Who submitted each card? Guess correctly to earn points!
                </p>
                <p className="text-purple-700 text-sm mt-1">
                  Cards may have been auto-generated — select "Auto" if you think so.
                </p>
              </div>

              <div className="space-y-4">
                {lobbyState.cards.map((card, index) => (
                  <div key={card.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-gray-400 w-5 flex-shrink-0 mt-0.5">{index + 1}</span>
                      <p className="text-gray-800 font-medium">{card.text}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-8">
                      {options.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setGuess(card.id, opt.value)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                            guesses[card.id] === opt.value
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400 hover:text-purple-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSubmit}
                disabled={!allGuessed}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {allGuessed ? 'Submit Guesses' : `Assign all ${lobbyState.cards.length} cards to continue`}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <p className="text-blue-800 font-medium text-lg">
                  Waiting for {ranker?.displayName} to guess who submitted each card...
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Cards being guessed</h3>
                {lobbyState.cards.map((card, index) => (
                  <div key={card.id} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                    <span className="text-sm font-bold text-gray-400 w-5 flex-shrink-0">{index + 1}</span>
                    <p className="text-gray-800">{card.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
