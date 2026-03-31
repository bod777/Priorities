import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types.ts';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

let globalSocket: TypedSocket | null = null;

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
    const attemptReconnect = () => {
      const token = localStorage.getItem('priorities_reconnect_token');
      const lobbyCode = localStorage.getItem('priorities_reconnect_lobby');
      if (token && lobbyCode) {
        console.log('Attempting reconnect with token');
        socket.emit('reconnect-player', { token, lobbyCode });
      }
    };

    socket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      attemptReconnect();
    });
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    if (socket.connected) {
      setConnected(true);
      attemptReconnect();
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket]);

  return { socket, connected };
}

export function saveReconnectInfo(token: string, lobbyCode: string): void {
  localStorage.setItem('priorities_reconnect_token', token);
  localStorage.setItem('priorities_reconnect_lobby', lobbyCode);
}

export function clearReconnectInfo(): void {
  localStorage.removeItem('priorities_reconnect_token');
  localStorage.removeItem('priorities_reconnect_lobby');
}
