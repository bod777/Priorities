import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types.ts';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: TypedSocket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connected };
}
