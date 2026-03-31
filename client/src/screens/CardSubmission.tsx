import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';

export function CardSubmission() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;
  const [cardText, setCardText] = useState('');

  if (!lobbyState || !playerId) return null;

  const isRanker = lobbyState.currentRankerId === playerId;
  const hasDone = lobbyState.submittedPlayerIds.includes(playerId);
  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);
  const multiMode = lobbyState.settings.multipleSubmissionsEnabled;

  const totalNonRankers = lobbyState.players.length - 1;
  const submittedCount = lobbyState.submittedPlayerIds.length;
  const myCardCount = lobbyState.playerCardCounts[playerId] || 0;
  const poolFull = lobbyState.cardPool === 0;

  const handleSubmitCard = () => {
    if (!socket || !cardText.trim()) return;
    socket.emit('submit-card', { text: cardText.trim() });
    setCardText('');
  };

  const handleDone = () => {
    if (!socket) return;
    socket.emit('done-submitting');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Round Header */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-purple-600">Card Submission</h1>
              <p className="text-gray-600 mt-1">
                Turn {lobbyState.currentTurn} of {lobbyState.totalTurns}
                <span className="text-gray-400 ml-2">
                  · Round {Math.ceil(lobbyState.currentTurn / lobbyState.rankerOrder.length)} of {Math.ceil(lobbyState.totalTurns / lobbyState.rankerOrder.length)}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Current Ranker</p>
              <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg px-4 py-2">
                <p className="font-bold text-purple-600">{ranker?.displayName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {isRanker ? (
            /* RANKER VIEW */
            <div className="text-center space-y-6">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8">
                <div className="text-5xl mb-4">👑</div>
                <h2 className="text-2xl font-bold text-purple-600 mb-3">You are the Ranker!</h2>
                <p className="text-gray-700 text-lg">Waiting for other players to submit their cards...</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Submissions Progress</span>
                  <span className="text-sm font-medium text-purple-600">{submittedCount} / {totalNonRankers} done</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-purple-600 h-4 transition-all duration-500 ease-out"
                    style={{ width: `${(submittedCount / totalNonRankers) * 100}%` }}
                  />
                </div>
              </div>

              <div className="text-left">
                <h3 className="font-semibold text-gray-700 mb-3">Players:</h3>
                <div className="space-y-2">
                  {lobbyState.players
                    .filter((p) => p.id !== lobbyState.currentRankerId)
                    .map((player) => {
                      const done = lobbyState.submittedPlayerIds.includes(player.id);
                      const cardCount = lobbyState.playerCardCounts[player.id] || 0;
                      return (
                        <div key={player.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                          <span className="font-medium">{player.displayName}</span>
                          {done ? (
                            <span className="text-green-600 text-sm flex items-center gap-1">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              {cardCount} card{cardCount !== 1 ? 's' : ''} · done
                            </span>
                          ) : cardCount > 0 ? (
                            <span className="text-blue-500 text-sm">{cardCount} card{cardCount !== 1 ? 's' : ''} · still submitting</span>
                          ) : (
                            <span className="text-gray-400 text-sm">Waiting...</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : hasDone ? (
            /* POST-DONE VIEW */
            <div className="text-center space-y-6">
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-8">
                <div className="text-5xl mb-4">✓</div>
                <h2 className="text-2xl font-bold text-green-800 mb-2">
                  {myCardCount} card{myCardCount !== 1 ? 's' : ''} submitted!
                </h2>
                <p className="text-green-700">Waiting for other players...</p>
              </div>
              <div>
                <p className="text-gray-600 mb-3">{submittedCount} of {totalNonRankers} players done</p>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-600 h-3 transition-all duration-500"
                    style={{ width: `${(submittedCount / totalNonRankers) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* GUESSER SUBMISSION VIEW */
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-900">
                  <strong>{ranker?.displayName}</strong> is the ranker this round. Submit a card for them to rank!
                </p>
              </div>

              {multiMode && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    You've submitted <strong>{myCardCount}</strong> card{myCardCount !== 1 ? 's' : ''}
                  </span>
                  <span className={`font-medium ${poolFull ? 'text-orange-500' : 'text-purple-600'}`}>
                    {poolFull ? 'Pool full' : `${lobbyState.cardPool} slot${lobbyState.cardPool !== 1 ? 's' : ''} remaining`}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Card</label>
                <textarea
                  value={cardText}
                  onChange={(e) => setCardText(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder="Type your card text here..."
                  maxLength={100}
                  rows={3}
                  autoFocus
                  disabled={poolFull}
                />
                <p className="text-sm text-gray-500 mt-1">{cardText.length} / 100 characters</p>
              </div>

              <button
                onClick={handleSubmitCard}
                disabled={!cardText.trim() || poolFull}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {multiMode && myCardCount > 0 ? 'Submit Another Card' : 'Submit Card'}
              </button>

              {multiMode && myCardCount > 0 && (
                <button
                  onClick={handleDone}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-green-700 transition"
                >
                  Done — I'm finished submitting
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
