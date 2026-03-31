import { useState } from 'react';
import { useSocket, clearReconnectInfo } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import type { GameSettings } from '../../../shared/src/types.ts';

export function Home() {
  const { socket, connected } = useSocket();
  const { dispatch } = useGame();

  const pendingToken = localStorage.getItem('priorities_reconnect_token');
  const pendingLobby = localStorage.getItem('priorities_reconnect_lobby');
  const [displayName, setDisplayName] = useState('');
  const [lobbyCode, setLobbyCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');

  const defaultSettings: GameSettings = {
    roundCount: 1,
    multipleSubmissionsEnabled: false,
  };

  const handleCreateLobby = () => {
    if (!socket || !displayName.trim()) return;
    console.log('Creating lobby with name:', displayName.trim());
    console.log('Socket:', socket);
    console.log('Socket connected:', socket.connected);
    dispatch({ type: 'SET_PLAYER', playerId: '', displayName: displayName.trim() });
    socket.emit('create-lobby', { displayName: displayName.trim(), settings: defaultSettings });
    console.log('Emitted create-lobby event');
  };

  const handleJoinLobby = () => {
    if (!socket || !displayName.trim() || !lobbyCode.trim()) return;
    dispatch({ type: 'SET_PLAYER', playerId: '', displayName: displayName.trim() });
    socket.emit('join-lobby', { code: lobbyCode.trim().toUpperCase(), displayName: displayName.trim() });
  };

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
        <div className="text-white text-2xl">Connecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-8 text-purple-600">Priorities</h1>

        {mode === 'menu' && (
          <div className="space-y-4">
            {pendingToken && pendingLobby && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 space-y-3">
                <p className="text-yellow-800 font-medium text-center">
                  Rejoin lobby <span className="font-bold">{pendingLobby}</span>?
                </p>
                <button
                  onClick={() => socket?.emit('reconnect-player', { token: pendingToken, lobbyCode: pendingLobby })}
                  className="w-full bg-yellow-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-yellow-600 transition"
                >
                  Rejoin Game
                </button>
                <button
                  onClick={() => { clearReconnectInfo(); window.location.reload(); }}
                  className="w-full text-yellow-700 text-sm underline hover:text-yellow-900 transition"
                >
                  Dismiss
                </button>
              </div>
            )}
            <button
              onClick={() => setMode('create')}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition"
            >
              Create Lobby
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full bg-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-pink-700 transition"
            >
              Join Lobby
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
              autoCapitalize="characters"
              maxLength={20}
            />
            <button
              onClick={handleCreateLobby}
              disabled={!displayName.trim()}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Create
            </button>
            <button
              onClick={() => setMode('menu')}
              className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 uppercase"
              autoCapitalize="characters"
              maxLength={20}
            />
            <input
              type="text"
              placeholder="Lobby code"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 uppercase"
              autoCapitalize="characters"
              maxLength={4}
            />
            <button
              onClick={handleJoinLobby}
              disabled={!displayName.trim() || !lobbyCode.trim()}
              className="w-full bg-pink-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-pink-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Join
            </button>
            <button
              onClick={() => setMode('menu')}
              className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
