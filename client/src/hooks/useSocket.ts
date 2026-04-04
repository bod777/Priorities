import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types.ts';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

let globalSocket: TypedSocket | null = null;
let reconnectEmitted = false;

function getSocket(): TypedSocket {
  if (!globalSocket) {
    globalSocket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    console.log('Created new socket instance');
  }
  return globalSocket;
}

export function useSocket() {
  const [socket] = useState<TypedSocket>(() => getSocket());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket]);

  return { socket, connected };
}

export function saveReconnectInfo(token: string, lobbyCode: string): void {
  localStorage.setItem(`priorities_token_${lobbyCode}`, token);
}

export function clearReconnectInfo(lobbyCode: string): void {
  localStorage.removeItem(`priorities_token_${lobbyCode}`);
}

export function getReconnectToken(lobbyCode: string): string | null {
  return localStorage.getItem(`priorities_token_${lobbyCode}`);
}

export function emitReconnectOnce(lobbyCode: string): boolean {
  if (reconnectEmitted) return false;
  const token = getReconnectToken(lobbyCode);
  if (!token || !globalSocket) return false;
  reconnectEmitted = true;
  globalSocket.emit('reconnect-player', { token, lobbyCode });
  // Reset after reconnect resolves so future navigations can reconnect
  globalSocket.once('reconnect-success', () => { reconnectEmitted = false; });
  globalSocket.once('reconnect-failed', () => { reconnectEmitted = false; });
  return true;
}
