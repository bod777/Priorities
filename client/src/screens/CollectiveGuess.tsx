import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { RankingBoard } from '../components/RankingBoard.tsx';

export function CollectiveGuess() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  if (!lobbyState || !playerId) return null;

  const isRanker = lobbyState.currentRankerId === playerId;
  const hasLocked = lobbyState.submittedPlayerIds.includes(playerId);
  const isFrozen = lobbyState.submittedPlayerIds.length > 0;
  const nonRankers = lobbyState.players.filter((p) => p.id !== lobbyState.currentRankerId);
  const nonRankerCount = nonRankers.length;
  const disconnectedCount = nonRankers.filter((p) => !p.connected).length;
  const lockedCount = lobbyState.submittedPlayerIds.length;
  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);

  const handleUpdateGuess = (newRanking: string[]) => {
    if (!socket || isRanker || isFrozen) return;
    socket.emit('update-collective-guess', { ranking: newRanking });
  };

  const handleLock = () => {
    if (!socket || isRanker) return;
    socket.emit('lock-collective-guess');
  };

  const handleUnlock = () => {
    if (!socket || isRanker) return;
    socket.emit('unlock-collective-guess');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-purple-600">Collective Guess</h1>
            <p className="text-gray-600 mt-2">
              Turn {lobbyState.currentTurn} of {lobbyState.totalTurns}
              <span className="text-gray-400 ml-2">
                · Round {Math.ceil(lobbyState.currentTurn / lobbyState.rankerOrder.length)} of {Math.ceil(lobbyState.totalTurns / lobbyState.rankerOrder.length)}
              </span>
            </p>
          </div>

          {!isRanker ? (
            <div className="space-y-4">
              <p className="text-gray-700">
                Work together to guess how {ranker?.displayName} ranked these cards!
              </p>

              {isFrozen && !hasLocked && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2 text-sm text-yellow-800">
                  Order locked by another player — waiting for everyone to confirm.
                </div>
              )}

              <RankingBoard
                cards={lobbyState.cards}
                ranking={lobbyState.collectiveGuessOrder}
                onRankingChange={handleUpdateGuess}
                disabled={isFrozen}
              />

              {!hasLocked ? (
                <button
                  onClick={handleLock}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition"
                >
                  Lock In Guess
                </button>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <div>
                    <p className="text-green-800 text-center font-medium">Locked!</p>
                    <p className="text-green-600 text-center text-sm mt-1">
                      {lockedCount} / {nonRankerCount} locked
                      {disconnectedCount > 0 && (
                        <span className="text-gray-400 ml-1">· {disconnectedCount} disconnected</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={handleUnlock}
                    className="w-full border border-green-400 text-green-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-green-100 transition"
                  >
                    Unlock
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <p className="text-blue-800 text-center font-medium">
                Waiting for other players to collectively guess your ranking...
              </p>
              <p className="text-blue-600 text-center mt-2">
                {lockedCount} / {nonRankerCount} locked
                {disconnectedCount > 0 && (
                  <span className="text-gray-400 ml-1">· {disconnectedCount} disconnected</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
