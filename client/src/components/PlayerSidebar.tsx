import { useGame } from '../context/GameContext.tsx';

interface PlayerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlayerSidebar({ isOpen, onClose }: PlayerSidebarProps) {
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  if (!lobbyState || !playerId) return null;

  const isGameActive = lobbyState.phase !== 'lobby';

  const players = isGameActive
    ? [...lobbyState.players].sort((a, b) => (lobbyState.scores[b.id] ?? 0) - (lobbyState.scores[a.id] ?? 0))
    : lobbyState.players;

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30" onClick={onClose} />}

      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-40 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 tracking-wide uppercase">Players</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <section className="px-4 py-4 border-b border-gray-100">
            <ul className="space-y-3">
              {players.map((player, index) => {
                const isCurrentRanker = lobbyState.currentRankerId === player.id;
                const isMe = player.id === playerId;
                const score = lobbyState.scores[player.id] ?? 0;

                return (
                  <li key={player.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${isCurrentRanker ? 'bg-yellow-50 border border-yellow-200' : ''}`}>
                    {isGameActive && (
                      <span className="text-xs text-gray-400 w-4 flex-shrink-0 text-right">{index + 1}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm truncate block ${isMe ? 'font-bold' : 'font-medium'} ${player.connected ? 'text-gray-800' : 'text-gray-400'}`}>
                        {player.displayName}
                      </span>
                      {!player.connected && (
                        <span className="text-xs text-gray-400">disconnected</span>
                      )}
                      {isCurrentRanker && (
                        <span className="text-xs text-yellow-700 font-medium">Ranking this turn</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isGameActive && (
                        <span className={`text-sm font-semibold ${isMe ? 'text-purple-600' : 'text-gray-700'}`}>
                          {score}
                        </span>
                      )}
                      {isMe && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">You</span>
                      )}
                      {player.isHost && <span title="Host">👑</span>}
                      {isCurrentRanker && <span title="Current ranker">🎯</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="px-4 py-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Settings</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex justify-between">
                <span>Rounds</span>
                <span className="font-medium">
                  {lobbyState.settings.roundCount}
                  <span className="text-gray-400 font-normal ml-1">({lobbyState.totalTurns} turns)</span>
                </span>
              </li>
              <li className="flex justify-between">
                <span>Multiple submissions</span>
                <span className={`font-medium ${lobbyState.settings.multipleSubmissionsEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {lobbyState.settings.multipleSubmissionsEnabled ? 'On' : 'Off'}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Guess authorship</span>
                <span className={`font-medium ${lobbyState.settings.authorshipEnabled ? 'text-green-600' : 'text-gray-500'}`}>
                  {lobbyState.settings.authorshipEnabled ? 'On' : 'Off'}
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
