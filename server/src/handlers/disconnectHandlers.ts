import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types.js';
import { lobbies, socketToLobby, getLobbyForSocket } from '../lobby.js';
import { toLobbyState } from '../lobby.js';
import { createPlayerCard } from '../cards.js';

const disconnectTimers = new Map<string, NodeJS.Timeout>();

export function registerDisconnectHandlers(
  io: Server<ClientEvents, ServerEvents>,
  socket: Socket<ClientEvents, ServerEvents>
) {
  socket.on('disconnect', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state) return;

    console.log(`Player disconnected: ${socket.id} from lobby ${state.lobbyCode}`);

    if (state.phase === 'lobby') {
      const player = state.players.get(socket.id);
      if (!player) return;

      state.players.delete(socket.id);
      state.scores.delete(socket.id);
      socketToLobby.delete(socket.id);

      if (state.players.size === 0) {
        lobbies.delete(state.lobbyCode);
        console.log(`Lobby ${state.lobbyCode} deleted (empty)`);
        return;
      }

      if (state.hostId === socket.id) {
        const newHost = state.players.values().next().value;
        if (newHost) {
          state.hostId = newHost.id;
          newHost.isHost = true;
        }
      }

      io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
    } else {
      const player = state.players.get(socket.id);
      if (!player) return;

      player.connected = false;
      io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));

      const timer = setTimeout(() => {
        handleAutoSubmit(io, socket.id, state.lobbyCode);
      }, 30000);

      disconnectTimers.set(socket.id, timer);
    }
  });

  socket.on('disconnecting', () => {
    const state = getLobbyForSocket(socket.id);
    if (state) {
      socket.leave(state.lobbyCode);
    }
  });
}

function handleAutoSubmit(
  io: Server<ClientEvents, ServerEvents>,
  socketId: string,
  lobbyCode: string
) {
  const state = lobbies.get(lobbyCode);
  if (!state) return;

  const player = state.players.get(socketId);
  if (!player || player.connected) {
    return;
  }

  if (state.submittedPlayerIds.has(socketId)) {
    return;
  }

  console.log(`Auto-submitting for disconnected player: ${socketId}`);

  if (state.phase === 'card_submission' && state.currentRankerId !== socketId) {
    const card = createPlayerCard('[disconnected]', socketId);
    state.cards.push(card);
    state.submittedPlayerIds.add(socketId);

    const nonRankers = Array.from(state.players.values()).filter(
      (p) => p.id !== state.currentRankerId
    );
    if (state.submittedPlayerIds.size >= nonRankers.length) {
      import('../game.js').then(({ advancePhase }) => {
        advancePhase(state);
        io.to(lobbyCode).emit('phase-changed', toLobbyState(state));
      });
    } else {
      io.to(lobbyCode).emit('player-submitted', { playerId: socketId });
    }
  } else if (state.phase === 'guessing' && state.currentRankerId !== socketId) {
    const shuffled = [...state.cards.map((c) => c.id)].sort(() => Math.random() - 0.5);
    state.guesses.set(socketId, shuffled);
    state.submittedPlayerIds.add(socketId);

    const nonRankers = Array.from(state.players.values()).filter(
      (p) => p.id !== state.currentRankerId
    );
    if (state.submittedPlayerIds.size >= nonRankers.length) {
      import('../game.js').then(({ advancePhase }) => {
        advancePhase(state);
        io.to(lobbyCode).emit('phase-changed', toLobbyState(state));
      });
    } else {
      io.to(lobbyCode).emit('player-submitted', { playerId: socketId });
    }
  } else if (state.phase === 'ranking' && state.currentRankerId === socketId) {
    const shuffled = [...state.cards.map((c) => c.id)].sort(() => Math.random() - 0.5);
    state.rankerRanking = shuffled;
    state.submittedPlayerIds.add(socketId);

    import('../game.js').then(({ advancePhase }) => {
      advancePhase(state);
      io.to(lobbyCode).emit('phase-changed', toLobbyState(state));
    });
  } else if (state.phase === 'authorship_guess' && state.currentRankerId !== socketId) {
    const guesses: Record<string, string> = {};
    state.cards.forEach((card) => {
      const randomPlayer = Array.from(state.players.values()).filter(
        (p) => p.id !== state.currentRankerId
      )[Math.floor(Math.random() * (state.players.size - 1))];
      guesses[card.id] = randomPlayer?.id || 'auto';
    });
    state.authorshipGuesses = guesses;
    state.submittedPlayerIds.add(socketId);

    const nonRankers = Array.from(state.players.values()).filter(
      (p) => p.id !== state.currentRankerId
    );
    if (state.submittedPlayerIds.size >= nonRankers.length) {
      import('../game.js').then(({ advancePhase }) => {
        advancePhase(state);
        io.to(lobbyCode).emit('phase-changed', toLobbyState(state));
      });
    } else {
      io.to(lobbyCode).emit('player-submitted', { playerId: socketId });
    }
  } else if (state.phase === 'personal_ranking') {
    const shuffled = [...state.cards.map((c) => c.id)].sort(() => Math.random() - 0.5);
    state.personalRankings.set(socketId, shuffled);
    state.submittedPlayerIds.add(socketId);

    if (state.submittedPlayerIds.size >= state.players.size) {
      import('../game.js').then(({ advancePhase }) => {
        advancePhase(state);
        io.to(lobbyCode).emit('phase-changed', toLobbyState(state));
      });
    } else {
      io.to(lobbyCode).emit('player-submitted', { playerId: socketId });
    }
  }

  disconnectTimers.delete(socketId);
}

export function clearDisconnectTimer(socketId: string) {
  const timer = disconnectTimers.get(socketId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(socketId);
  }
}

export function handleReconnect(
  io: Server<ClientEvents, ServerEvents>,
  socket: Socket<ClientEvents, ServerEvents>,
  lobbyCode: string
) {
  const state = lobbies.get(lobbyCode);
  if (!state) return false;

  const oldSocketId = Array.from(state.players.entries()).find(
    ([, player]) => !player.connected
  )?.[0];

  if (oldSocketId) {
    const player = state.players.get(oldSocketId);
    if (player) {
      state.players.delete(oldSocketId);
      socketToLobby.delete(oldSocketId);

      player.id = socket.id;
      player.connected = true;

      state.players.set(socket.id, player);
      socketToLobby.set(socket.id, lobbyCode);

      if (state.hostId === oldSocketId) {
        state.hostId = socket.id;
      }
      if (state.currentRankerId === oldSocketId) {
        state.currentRankerId = socket.id;
      }

      const oldGuess = state.guesses.get(oldSocketId);
      if (oldGuess) {
        state.guesses.delete(oldSocketId);
        state.guesses.set(socket.id, oldGuess);
      }

      const oldRanking = state.personalRankings.get(oldSocketId);
      if (oldRanking) {
        state.personalRankings.delete(oldSocketId);
        state.personalRankings.set(socket.id, oldRanking);
      }

      const oldScore = state.scores.get(oldSocketId);
      if (oldScore !== undefined) {
        state.scores.delete(oldSocketId);
        state.scores.set(socket.id, oldScore);
      }

      clearDisconnectTimer(oldSocketId);

      socket.join(lobbyCode);
      io.to(lobbyCode).emit('lobby-updated', toLobbyState(state));

      return true;
    }
  }

  return false;
}
