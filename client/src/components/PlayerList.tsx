import type { Player } from '../../../shared/src/types.ts';

interface PlayerListProps {
  players: Player[];
  currentRankerId?: string | null;
}

export function PlayerList({ players, currentRankerId }: PlayerListProps) {
  return (
    <div className="space-y-2">
      {players.map((player) => (
        <div
          key={player.id}
          className={`flex items-center justify-between bg-gray-50 rounded-lg p-3 ${
            !player.connected ? 'opacity-50' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            {!player.connected && (
              <span className="text-red-500 text-xs" title="Disconnected">●</span>
            )}
            <span className="font-medium">{player.displayName}</span>
          </div>
          <div className="flex gap-2">
            {player.isHost && (
              <span className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm">
                Host
              </span>
            )}
            {currentRankerId === player.id && (
              <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm">
                Ranker
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
