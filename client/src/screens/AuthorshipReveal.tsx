import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { GameHeader } from '../components/GameHeader.tsx';

export function AuthorshipReveal() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  if (!lobbyState || !playerId) return null;

  const isHost = lobbyState.hostId === playerId;
  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);

  // Build name map from current players
  const playerNames: Record<string, string> = {};
  for (const p of lobbyState.players) {
    playerNames[p.id] = p.displayName;
  }

  const getName = (id: string) =>
    id === 'auto' ? 'Auto (generated)' : (playerNames[id] ?? id);

  const results = lobbyState.authorshipResults;
  const guesses = lobbyState.authorshipGuesses;

  const correctCount = results && guesses
    ? lobbyState.cards.filter((c) => results[c.id] === guesses[c.id]).length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <GameHeader
          title="Authorship Reveal"
          currentTurn={lobbyState.currentTurn}
          totalTurns={lobbyState.totalTurns}
          rankerOrder={lobbyState.rankerOrder}
        />

        <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="text-center">
            <p className="text-gray-600">
              {ranker?.displayName} guessed{' '}
              <span className="font-bold text-purple-600">
                {correctCount} / {lobbyState.cards.length}
              </span>{' '}
              correctly
            </p>
          </div>

          <div className="space-y-3">
            {lobbyState.cards.map((card, index) => {
              const trueAuthorId = results?.[card.id];
              const guessedAuthorId = guesses?.[card.id];
              const isCorrect = trueAuthorId === guessedAuthorId;
              return (
                <div
                  key={card.id}
                  className={`rounded-lg p-4 border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-sm font-bold text-gray-400 w-5 flex-shrink-0 mt-0.5">{index + 1}</span>
                    <p className="text-gray-800 font-medium">{card.text}</p>
                    <span className="ml-auto text-lg flex-shrink-0">{isCorrect ? '✓' : '✗'}</span>
                  </div>
                  <div className="flex gap-4 text-xs pl-8">
                    <span className="text-gray-500">
                      Guessed: <span className="font-medium text-gray-700">{getName(guessedAuthorId ?? '')}</span>
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">
                      Actually: <span className="font-medium text-gray-700">{getName(trueAuthorId ?? '')}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {isHost ? (
            <button
              onClick={() => socket?.emit('continue-to-ranking')}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition"
            >
              Continue to Ranking
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-center">Waiting for host to continue...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
