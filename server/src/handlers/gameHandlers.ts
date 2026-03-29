import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, TurnResult } from '../../../shared/src/types.js';
import { getLobbyForSocket, toLobbyState, type ServerGameState, lobbies, socketToLobby } from '../lobby.js';
import { createPlayerCard } from '../cards.js';
import { startGame, advancePhase } from '../game.js';
import { calculateScore } from '../scoring.js';

function emitRevealResults(io: Server<ClientEvents, ServerEvents>, state: ServerGameState): void {
  const trueRanking = state.rankerRanking!;
  const turnScores: Record<string, number> = {};

  if (state.collectiveGuess) {
    const score = calculateScore(trueRanking, state.collectiveGuess);
    for (const [playerId] of state.players) {
      if (playerId !== state.currentRankerId) {
        turnScores[playerId] = score;
        state.scores.set(playerId, (state.scores.get(playerId) || 0) + score);
      }
    }
    if (!state.rankerStats.has(state.currentRankerId!)) {
      state.rankerStats.set(state.currentRankerId!, []);
    }
    state.rankerStats.get(state.currentRankerId!)!.push(score);
  }

  const result: TurnResult = {
    turnNumber: state.currentTurn,
    rankerId: state.currentRankerId!,
    cards: state.cards.map((c) => ({ id: c.id, text: c.text })),
    trueRanking,
    collectiveGuess: state.collectiveGuess,
    scores: turnScores,
    totalScores: Object.fromEntries(state.scores),
  };

  state.turnHistory.push(result);
  io.to(state.lobbyCode).emit('reveal-results', result);
}

function emitGameOver(io: Server<ClientEvents, ServerEvents>, state: ServerGameState): void {
  const finalScores = Object.fromEntries(state.scores);

  let mostPredictable: { playerId: string; avgScore: number } | null = null;
  let leastPredictable: { playerId: string; avgScore: number } | null = null;

  for (const [rankerId, scores] of state.rankerStats) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (!mostPredictable || avg > mostPredictable.avgScore) {
      mostPredictable = { playerId: rankerId, avgScore: avg };
    }
    if (!leastPredictable || avg < leastPredictable.avgScore) {
      leastPredictable = { playerId: rankerId, avgScore: avg };
    }
  }

  let bestGuesser: { playerId: string; totalScore: number } | null = null;
  for (const [playerId, score] of state.scores) {
    if (!bestGuesser || score > bestGuesser.totalScore) {
      bestGuesser = { playerId, totalScore: score };
    }
  }

  io.to(state.lobbyCode).emit('game-over', {
    finalScores,
    turnHistory: state.turnHistory,
    superlatives: { mostPredictable, leastPredictable, bestGuesser },
  });
}

function checkPhaseAdvance(io: Server<ClientEvents, ServerEvents>, state: ServerGameState): void {
  const nonRankerCount = state.players.size - 1;

  if (state.phase === 'card_submission' && state.submittedPlayerIds.size >= nonRankerCount) {
    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  }
}

const AUTO_SUBMIT_DELAY_MS = 60_000;

function handleAutoSubmit(io: Server<ClientEvents, ServerEvents>, state: ServerGameState, playerId: string): void {
  state.pendingTimers.delete(playerId);

  if (state.phase === 'card_submission' && playerId !== state.currentRankerId) {
    if (!state.submittedPlayerIds.has(playerId)) {
      state.cards.push(createPlayerCard('...', playerId));
      state.submittedPlayerIds.add(playerId);
      checkPhaseAdvance(io, state);
    }
    return;
  }

  if (state.phase === 'ranking' && playerId === state.currentRankerId) {
    const shuffled = [...state.cards.map((c) => c.id)].sort(() => Math.random() - 0.5);
    state.rankerRanking = shuffled;
    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    return;
  }

  if (state.phase === 'guessing' && playerId !== state.currentRankerId) {
    if (!state.submittedPlayerIds.has(playerId)) {
      state.submittedPlayerIds.add(playerId);
      io.to(state.lobbyCode).emit('player-submitted', { playerId });
      const nonRankerCount = state.players.size - 1;
      if (state.submittedPlayerIds.size >= nonRankerCount) {
        advancePhase(state);
        emitRevealResults(io, state);
        io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
      }
    }
    return;
  }
}

export function registerGameHandlers(
  io: Server<ClientEvents, ServerEvents>,
  socket: Socket<ClientEvents, ServerEvents>
) {
  socket.on('start-game', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.hostId !== socket.id) return;
    if (state.players.size < 3) return;

    startGame(state);
    console.log(`Game started in lobby ${state.lobbyCode}, ranker: ${state.currentRankerId}`);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  });

  socket.on('submit-card', ({ text }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'card_submission') return;
    if (socket.id === state.currentRankerId) return;
    if (state.submittedPlayerIds.has(socket.id)) return;

    state.cards.push(createPlayerCard(text, socket.id));
    state.submittedPlayerIds.add(socket.id);

    io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });

    const nonRankerCount = state.players.size - 1;
    if (state.submittedPlayerIds.size >= nonRankerCount) {
      console.log('All cards submitted, advancing phase');
      advancePhase(state);
      io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    }
  });

  socket.on('submit-ranking', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'ranking') return;
    if (socket.id !== state.currentRankerId) return;
    if (ranking.length !== 5) return;

    state.rankerRanking = ranking;
    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  });

  socket.on('update-collective-guess', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (socket.id === state.currentRankerId) return;
    if (state.submittedPlayerIds.size > 0) return;

    state.collectiveGuess = ranking;
    io.to(state.lobbyCode).emit('collective-guess-updated', { ranking });
  });

  socket.on('unlock-collective-guess', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (socket.id === state.currentRankerId) return;
    if (!state.submittedPlayerIds.has(socket.id)) return;

    state.submittedPlayerIds.delete(socket.id);
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });

  socket.on('lock-collective-guess', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (!state.collectiveGuess) return;
    if (socket.id === state.currentRankerId) return;
    if (state.submittedPlayerIds.has(socket.id)) return;

    state.submittedPlayerIds.add(socket.id);
    io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });

    const nonRankerCount = state.players.size - 1;
    if (state.submittedPlayerIds.size >= nonRankerCount) {
      advancePhase(state);
      emitRevealResults(io, state);
      io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    }
  });

  socket.on('reset-game', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.hostId !== socket.id) return;

    state.phase = 'lobby';
    state.currentTurn = 0;
    state.currentRankerId = null;
    state.cards = [];
    state.rankerRanking = null;
    state.collectiveGuess = null;
    state.submittedPlayerIds = new Set();
    state.turnHistory = [];
    state.rankerStats = new Map();
    for (const id of state.scores.keys()) {
      state.scores.set(id, 0);
    }

    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });

  socket.on('next-turn', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'reveal') return;
    if (socket.id !== state.hostId) return;

    advancePhase(state);

    if ((state as ServerGameState).phase === 'game_over') {
      emitGameOver(io, state);
    } else {
      io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    }
  });

  socket.on('disconnect', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state) return;

    const player = state.players.get(socket.id);
    if (player) {
      player.connected = false;
    }

    if (state.phase === 'lobby') {
      state.players.delete(socket.id);
      state.rankerOrder = state.rankerOrder.filter((id) => id !== socket.id);
      state.scores.delete(socket.id);
      socketToLobby.delete(socket.id);

      if (state.hostId === socket.id && state.players.size > 0) {
        const newHost = state.players.values().next().value!;
        newHost.isHost = true;
        state.hostId = newHost.id;
      }

      if (state.players.size === 0) {
        lobbies.delete(state.lobbyCode);
        return;
      }
    }

    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));

    const timer = setTimeout(() => {
      const currentState = lobbies.get(state.lobbyCode);
      if (!currentState) return;
      const p = currentState.players.get(socket.id);
      if (!p || p.connected) return;

      if (currentState.hostId === socket.id) {
        const nextConnected = Array.from(currentState.players.values()).find(
          (pl) => pl.id !== socket.id && pl.connected
        );
        if (nextConnected) {
          nextConnected.isHost = true;
          currentState.hostId = nextConnected.id;
          io.to(currentState.lobbyCode).emit('lobby-updated', toLobbyState(currentState));
        }
      }

      handleAutoSubmit(io, currentState, socket.id);
    }, AUTO_SUBMIT_DELAY_MS);

    state.pendingTimers.set(socket.id, timer);
  });
}

export function onPhaseChange(io: Server<ClientEvents, ServerEvents>, state: ServerGameState): void {
  if (state.phase === 'reveal') {
    emitRevealResults(io, state);
  } else if (state.phase === 'game_over') {
    emitGameOver(io, state);
  }
}
