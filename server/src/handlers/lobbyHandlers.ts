import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types.js';
import { createLobby, joinLobby, getLobbyForSocket, toLobbyState } from '../lobby.js';

export function registerLobbyHandlers(
  io: Server<ClientEvents, ServerEvents>,
  socket: Socket<ClientEvents, ServerEvents>
) {
  socket.on('create-lobby', ({ displayName, settings }) => {
    console.log('Server: Received create-lobby event', { displayName, settings });
    const state = createLobby(socket.id, displayName, settings);
    console.log('Server: Created lobby', state.lobbyCode);
    socket.join(state.lobbyCode);
    socket.emit('lobby-created', { lobbyCode: state.lobbyCode, playerId: socket.id });
    console.log('Server: Emitted lobby-created');
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
    console.log('Server: Emitted lobby-updated');
  });

  socket.on('join-lobby', ({ code, displayName }) => {
    const state = joinLobby(code.toUpperCase(), socket.id, displayName);
    if (!state) {
      socket.emit('error', { message: 'Lobby not found, full, or game already started.' });
      return;
    }
    socket.join(state.lobbyCode);
    socket.emit('lobby-joined', { playerId: socket.id });
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });

  socket.on('update-settings', ({ settings }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.hostId !== socket.id || state.phase !== 'lobby') return;
    Object.assign(state.settings, settings);
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });

  socket.on('update-ranker-order', ({ order }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.hostId !== socket.id || state.phase !== 'lobby') return;
    const playerIds = new Set(state.players.keys());
    if (order.length !== playerIds.size || !order.every((id) => playerIds.has(id))) return;
    state.rankerOrder = order;
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });
}
