import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';

export function CardSubmission() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  const [cardTexts, setCardTexts] = useState<string[]>([]);

  if (!lobbyState || !playerId) return null;

  const hasSubmitted = lobbyState.submittedPlayerIds.includes(playerId);

  const handleSubmit = () => {
    if (!socket || !cardTexts[0]?.trim()) return;
    socket.emit('submit-card', { text: cardTexts[0].trim() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-purple-600">Submit Your Cards</h1>
            <p className="text-gray-600 mt-2">
              Round {lobbyState.currentRound} of {lobbyState.totalRounds}
            </p>
          </div>

          {!hasSubmitted ? (
            <div className="space-y-4">
              <p className="text-gray-700">
                Submit a card that completes the phrase or topic.
              </p>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Your Card
                </label>
                <input
                  type="text"
                  value={cardTexts[0] || ''}
                  onChange={(e) => setCardTexts([e.target.value])}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Type something..."
                  maxLength={100}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!cardTexts[0]?.trim()}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Submit
              </button>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <p className="text-green-800 text-center font-medium">
                Cards submitted! Waiting for other players...
              </p>
              <p className="text-green-600 text-center mt-2">
                {lobbyState.submittedPlayerIds.length} / {lobbyState.players.length} players
                ready
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
