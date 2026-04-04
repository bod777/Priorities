import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket, getReconnectToken, clearReconnectInfo, emitReconnectOnce } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { GameRouter } from '../App.tsx';

export function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const { state } = useGame();
  const { lobbyState } = state;

  const lobbyCode = code!.toUpperCase();
  const hasToken = !!getReconnectToken(lobbyCode);

  const [status, setStatus] = useState<'reconnecting' | 'join-form' | 'in-lobby'>(
    hasToken ? 'reconnecting' : 'join-form'
  );
  const [displayName, setDisplayName] = useState('');
  const [joinError, setJoinError] = useState('');

  // Show inline errors on the join form
  useEffect(() => {
    if (!socket || status !== 'join-form') return;
    const onError = (data: { message: string }) => setJoinError(data.message);
    socket.on('error', onError);
    return () => { socket.off('error', onError); };
  }, [socket, status]);

  // Once lobbyState is populated we're successfully in the lobby
  useEffect(() => {
    if (lobbyState) setStatus('in-lobby');
  }, [lobbyState]);

  // Fire reconnect as soon as socket is connected — guarded by module-level flag
  useEffect(() => {
    if (status !== 'reconnecting') return;

    const tryReconnect = () => {
      const emitted = emitReconnectOnce(lobbyCode);
      if (!emitted) {
        // No token — fall back to join form
        setStatus('join-form');
      }
    };

    if (connected) {
      tryReconnect();
    }
    // connected changing to true will re-run this effect
  }, [connected, status, lobbyCode]);

  // Listen for reconnect-failed to show join form
  useEffect(() => {
    if (!socket || status !== 'reconnecting') return;
    const onFailed = () => {
      clearReconnectInfo(lobbyCode);
      setStatus('join-form');
    };
    socket.on('reconnect-failed', onFailed);
    return () => { socket.off('reconnect-failed', onFailed); };
  }, [socket, status, lobbyCode]);

  const handleJoin = () => {
    if (!socket || !displayName.trim()) return;
    setJoinError('');
    socket.emit('join-lobby', { code: lobbyCode, displayName: displayName.trim().toUpperCase() });
  };

  if (status === 'reconnecting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
        <div className="text-white text-2xl">Rejoining {lobbyCode}...</div>
      </div>
    );
  }

  if (status === 'in-lobby') {
    return <GameRouter />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-purple-600">Join Game</h1>
          <p className="text-gray-500 mt-1">Lobby <span className="font-bold text-gray-700">{lobbyCode}</span></p>
        </div>

        {joinError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {joinError}
          </div>
        )}

        <input
          type="text"
          placeholder="Your display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 uppercase"
          autoCapitalize="characters"
          maxLength={20}
          autoFocus
        />

        <button
          onClick={handleJoin}
          disabled={!displayName.trim() || !connected}
          className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Join
        </button>

        <button
          onClick={() => navigate('/')}
          className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
