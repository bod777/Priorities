import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types.js';
import { createLobby, joinLobby, reconnectPlayer, getLobbyForSocket, toLobbyState } from '../lobby.js';

export function registerLobbyHandlers(
  io: Server<ClientEvents, ServerEvents>,
  socket: Socket<ClientEvents, ServerEvents>
) {
  socket.on('create-lobby', ({ displayName, settings }) => {
    console.log('Server: Received create-lobby event', { displayName, settings });
    const { state, token } = createLobby(socket.id, displayName, settings);
    console.log('Server: Created lobby', state.lobbyCode);
    socket.join(state.lobbyCode);
    socket.emit('lobby-created', { lobbyCode: state.lobbyCode, playerId: socket.id, reconnectToken: token });
    console.log('Server: Emitted lobby-created');
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
    console.log('Server: Emitted lobby-updated');
  });

  socket.on('join-lobby', ({ code, displayName }) => {
    const result = joinLobby(code.toUpperCase(), socket.id, displayName);
    if (!result) {
      socket.emit('error', { message: 'Lobby not found, full, or game already started.' });
      return;
    }
    const { state, token } = result;
    socket.join(state.lobbyCode);
    socket.emit('lobby-joined', { playerId: socket.id, lobbyCode: state.lobbyCode, reconnectToken: token });
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });

  socket.on('reconnect-player', ({ token, lobbyCode }) => {
    const result = reconnectPlayer(token, socket.id);
    if (!result) {
      socket.emit('reconnect-failed', { message: 'Could not rejoin — lobby may have ended.' });
      return;
    }
    const { state, playerId } = result;
    const newToken = Array.from(state.reconnectTokens.entries()).find(([, id]) => id === playerId)?.[0];
    socket.join(state.lobbyCode);
    socket.emit('reconnect-success', { ...toLobbyState(state), playerId, reconnectToken: newToken! });
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
    console.log(`Player ${playerId} reconnected to lobby ${lobbyCode}`);
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
