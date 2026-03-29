import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types.js';

// Disconnect handling is registered in gameHandlers.ts
export function registerDisconnectHandlers(
  _io: Server<ClientEvents, ServerEvents>,
  _socket: Socket<ClientEvents, ServerEvents>
) {}
