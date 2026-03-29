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
