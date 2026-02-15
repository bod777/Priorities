import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import type { GameSettings } from '../../../shared/src/types.ts';

export function Lobby() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  const [localSettings, setLocalSettings] = useState<GameSettings>(
    lobbyState?.settings || {
      guessingMode: 'collective',
      authorshipGuess: true,
      personalRanking: true,
      promptsEnabled: false,
      roundCount: 3,
    }
  );

  if (!lobbyState || !playerId) return null;

  const isHost = lobbyState.hostId === playerId;
  const canStart = lobbyState.players.length >= 3;

  const handleUpdateSettings = (updates: Partial<GameSettings>) => {
    if (!socket || !isHost) return;
    const newSettings = { ...localSettings, ...updates };
    setLocalSettings(newSettings);
    socket.emit('update-settings', { settings: updates });
  };

  const handleStartGame = () => {
    if (!socket || !isHost || !canStart) return;
    socket.emit('start-game');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-purple-600">Lobby</h1>
            <div className="text-right">
              <div className="text-sm text-gray-500">Lobby Code</div>
              <div className="text-2xl font-bold text-purple-600">{lobbyState.lobbyCode}</div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-3">Players ({lobbyState.players.length}/6)</h2>
            <div className="space-y-2">
              {lobbyState.players.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between bg-gray-50 rounded-lg p-3 ${
                    !player.connected ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {!player.connected && (
                      <span className="text-red-500 text-xs">●</span>
                    )}
                    <span className="font-medium">{player.displayName}</span>
                  </div>
                  {player.isHost && (
                    <span className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {isHost && (
            <div className="space-y-4 mb-6">
              <h2 className="text-xl font-semibold">Game Settings</h2>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Rounds: {localSettings.roundCount}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={localSettings.roundCount}
                  onChange={(e) =>
                    handleUpdateSettings({ roundCount: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localSettings.guessingMode === 'collective'}
                    onChange={(e) =>
                      handleUpdateSettings({ guessingMode: e.target.checked ? 'collective' : 'individual' })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">Collective Guessing Mode</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localSettings.authorshipGuess}
                    onChange={(e) =>
                      handleUpdateSettings({ authorshipGuess: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">Authorship Guess</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localSettings.personalRanking}
                    onChange={(e) =>
                      handleUpdateSettings({ personalRanking: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">Personal Ranking</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localSettings.promptsEnabled}
                    onChange={(e) =>
                      handleUpdateSettings({ promptsEnabled: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm">Prompts Enabled</span>
                </label>
              </div>
            </div>
          )}

          {!isHost && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 text-center">
                Waiting for host to start the game...
              </p>
            </div>
          )}

          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {canStart ? 'Start Game' : 'Need at least 3 players'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
