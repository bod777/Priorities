import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';

export function AuthorshipGuess() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  const [guesses, setGuesses] = useState<Record<string, string>>({});

  if (!lobbyState || !playerId) return null;

  const isRanker = lobbyState.currentRankerId === playerId;
  const hasSubmitted = lobbyState.submittedPlayerIds.includes(playerId);

  const players = lobbyState.players.filter((p) => p.id !== lobbyState.currentRankerId);

  const handleGuessChange = (cardId: string, authorId: string) => {
    setGuesses((prev) => ({ ...prev, [cardId]: authorId }));
  };

  const handleSubmit = () => {
    if (!socket || isRanker) return;
    socket.emit('submit-authorship-guess', { guesses });
  };

  const allGuessed = lobbyState.cards.every((card) => guesses[card.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-purple-600">Authorship Guess</h1>
            <p className="text-gray-600 mt-2">
              Round {lobbyState.currentRound} of {lobbyState.totalRounds}
            </p>
          </div>

          {!isRanker && !hasSubmitted ? (
            <div className="space-y-6">
              <p className="text-gray-700">
                Guess who wrote each card!
              </p>

              {lobbyState.cards.map((card) => (
                <div key={card.id} className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-800 mb-3 font-medium">{card.text}</p>
                  <div className="flex flex-wrap gap-2">
                    {players.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => handleGuessChange(card.id, player.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          guesses[card.id] === player.id
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        {player.displayName}
                      </button>
                    ))}
                    <button
                      onClick={() => handleGuessChange(card.id, 'auto')}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        guesses[card.id] === 'auto'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:border-purple-400'
                      }`}
                    >
                      Auto-generated
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={handleSubmit}
                disabled={!allGuessed}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Submit Guesses
              </button>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-blue-800 text-center font-medium">
                {isRanker
                  ? 'Waiting for other players to guess authorship...'
                  : 'Guesses submitted! Waiting for other players...'}
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
