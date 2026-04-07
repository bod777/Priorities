import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { RankingBoard } from '../components/RankingBoard.tsx';
import { GameHeader } from '../components/GameHeader.tsx';

export function IndividualGuess() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;
  const [localRanking, setLocalRanking] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);

  if (!lobbyState || !playerId) return null;

  if (localRanking.length === 0 && lobbyState.cards.length > 0) {
    setLocalRanking(lobbyState.cards.map((c) => c.id));
  }

  const isRanker = lobbyState.currentRankerId === playerId;
  const hasSubmitted = lobbyState.submittedPlayerIds.includes(playerId);
  const nonRankers = lobbyState.players.filter((p) => p.id !== lobbyState.currentRankerId);
  const nonRankerCount = nonRankers.length;
  const submittedCount = lobbyState.submittedPlayerIds.length;
  const disconnectedCount = nonRankers.filter((p) => !p.connected).length;
  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);

  const handleSubmit = () => {
    if (!socket || !confirmed) return;
    socket.emit('submit-individual-guess', { ranking: localRanking });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <GameHeader
          title="Individual Guess"
          currentTurn={lobbyState.currentTurn}
          totalTurns={lobbyState.totalTurns}
          rankerOrder={lobbyState.rankerOrder}
        />
        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {isRanker ? (
            /* RANKER VIEW */
            <div className="text-center space-y-6">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8">
                <div className="text-5xl mb-4">👑</div>
                <h2 className="text-2xl font-bold text-purple-600 mb-3">You are the Ranker!</h2>
                <p className="text-gray-700 text-lg">Waiting for players to submit their guesses...</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Submissions Progress</span>
                  <span className="text-sm font-medium text-purple-600">{submittedCount} / {nonRankerCount} submitted</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-purple-600 h-4 transition-all duration-500 ease-out"
                    style={{ width: `${nonRankerCount > 0 ? (submittedCount / nonRankerCount) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="text-left">
                <h3 className="font-semibold text-gray-700 mb-3">Players:</h3>
                <div className="space-y-2">
                  {nonRankers.map((player) => {
                    const done = lobbyState.submittedPlayerIds.includes(player.id);
                    return (
                      <div key={player.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <span className="font-medium">{player.displayName}</span>
                        {done ? (
                          <span className="text-green-600 text-sm flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Done
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">Waiting...</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : hasSubmitted ? (
            /* SUBMITTED VIEW */
            <div className="text-center space-y-6">
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-8">
                <div className="text-5xl mb-4">✓</div>
                <h2 className="text-2xl font-bold text-green-800 mb-2">Guess submitted!</h2>
                <p className="text-green-700">Waiting for others...</p>
              </div>
              <div>
                <p className="text-gray-600 mb-3">{submittedCount} of {nonRankerCount} players submitted</p>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-600 h-3 transition-all duration-500"
                    style={{ width: `${nonRankerCount > 0 ? (submittedCount / nonRankerCount) * 100 : 0}%` }}
                  />
                </div>
                {disconnectedCount > 0 && (
                  <p className="text-gray-400 text-sm mt-2">{disconnectedCount} disconnected</p>
                )}
              </div>
            </div>
          ) : confirmed ? (
            /* CONFIRMATION VIEW */
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <p className="text-yellow-800 font-medium text-center">Are you sure? You can't change this.</p>
              </div>
              <p className="text-gray-700 font-medium">Your ranking:</p>
              <div className="space-y-2">
                {localRanking.map((cardId, index) => {
                  const card = lobbyState.cards.find((c) => c.id === cardId);
                  return (
                    <div key={cardId} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                      <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-gray-800 text-sm">{card?.text}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmed(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Go Back
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  Submit
                </button>
              </div>
            </div>
          ) : (
            /* RANKING VIEW */
            <div className="space-y-4">
              <p className="text-gray-700">
                How do you think <strong>{ranker?.displayName}</strong> ranked these cards? Your guess is private!
              </p>
              <RankingBoard
                cards={lobbyState.cards}
                ranking={localRanking}
                onRankingChange={setLocalRanking}
                disabled={false}
              />
              <button
                onClick={() => setConfirmed(true)}
                className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Lock In My Guess
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
