import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, RoundResult } from '../../../shared/src/types.js';
import { getLobbyForSocket, toLobbyState, type ServerGameState, lobbies, socketToLobby } from '../lobby.js';
import { createPlayerCard } from '../cards.js';
import { startGame, advancePhase } from '../game.js';
import { calculateScore, calculateAuthorshipScore } from '../scoring.js';

function emitRevealResults(io: Server<ClientEvents, ServerEvents>, state: ServerGameState): void {
  const trueRanking = state.rankerRanking!;
  const roundScores: Record<string, number> = {};

  if (state.settings.guessingMode === 'individual') {
    for (const [playerId, guess] of state.guesses) {
      const score = calculateScore(trueRanking, guess);
      roundScores[playerId] = score;
      state.scores.set(playerId, (state.scores.get(playerId) || 0) + score);

      if (!state.rankerStats.has(state.currentRankerId!)) {
        state.rankerStats.set(state.currentRankerId!, []);
      }
      state.rankerStats.get(state.currentRankerId!)!.push(score);
    }
  } else if (state.collectiveGuess) {
    const score = calculateScore(trueRanking, state.collectiveGuess);
    for (const [playerId] of state.players) {
      if (playerId !== state.currentRankerId) {
        roundScores[playerId] = score;
        state.scores.set(playerId, (state.scores.get(playerId) || 0) + score);
      }
    }
    if (!state.rankerStats.has(state.currentRankerId!)) {
      state.rankerStats.set(state.currentRankerId!, []);
    }
    state.rankerStats.get(state.currentRankerId!)!.push(score);
  }

  const result: RoundResult = {
    roundNumber: state.currentRound,
    rankerId: state.currentRankerId!,
    cards: state.cards.map((c) => ({ id: c.id, text: c.text })),
    trueRanking,
    guesses: Object.fromEntries(state.guesses),
    collectiveGuess: state.collectiveGuess,
    scores: roundScores,
  };

  if (state.settings.authorshipGuess && state.authorshipGuesses) {
    result.authorship = Object.fromEntries(
      state.cards.map((c) => [c.id, c.authorId])
    );
    result.authorshipGuesses = state.authorshipGuesses;
    result.authorshipScore = calculateAuthorshipScore(
      state.authorshipGuesses, state.cards
    );
  }

  if (state.settings.personalRanking && state.personalRankings.size > 0) {
    result.personalRankings = Object.fromEntries(state.personalRankings);
  }

  state.roundHistory.push(result);
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
    roundHistory: state.roundHistory,
    superlatives: { mostPredictable, leastPredictable, bestGuesser },
  });
}

function checkPhaseAdvance(io: Server<ClientEvents, ServerEvents>, state: ServerGameState): void {
  const nonRankerCount = state.players.size - 1;

  if (state.phase === 'card_submission' && state.submittedPlayerIds.size >= nonRankerCount) {
    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  } else if (state.phase === 'guessing' && state.settings.guessingMode === 'individual' && state.submittedPlayerIds.size >= nonRankerCount) {
    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  } else if (state.phase === 'personal_ranking' && state.submittedPlayerIds.size >= state.players.size) {
    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  }
}

function handleAutoSubmit(io: Server<ClientEvents, ServerEvents>, state: ServerGameState, playerId: string): void {
  if (state.phase === 'card_submission' && playerId !== state.currentRankerId) {
    state.cards.push(createPlayerCard('...', playerId));
    state.submittedPlayerIds.add(playerId);
    checkPhaseAdvance(io, state);
  } else if (state.phase === 'guessing' && playerId !== state.currentRankerId) {
    const randomOrder = state.cards.map((c) => c.id).sort(() => Math.random() - 0.5);
    state.guesses.set(playerId, randomOrder);
    state.submittedPlayerIds.add(playerId);
    checkPhaseAdvance(io, state);
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

  socket.on('submit-guess', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (socket.id === state.currentRankerId) return;
    if (state.submittedPlayerIds.has(socket.id)) return;
    if (ranking.length !== 5) return;

    state.guesses.set(socket.id, ranking);
    state.submittedPlayerIds.add(socket.id);

    io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });

    const nonRankerCount = state.players.size - 1;
    if (state.submittedPlayerIds.size >= nonRankerCount) {
      advancePhase(state);
      if ((state as ServerGameState).phase === 'reveal') {
        emitRevealResults(io, state);
      }
      io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    }
  });

  socket.on('submit-personal-ranking', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'personal_ranking') return;
    if (state.submittedPlayerIds.has(socket.id)) return;

    state.personalRankings.set(socket.id, ranking);
    state.submittedPlayerIds.add(socket.id);

    io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });

    if (state.submittedPlayerIds.size >= state.players.size) {
      advancePhase(state);
      if ((state as ServerGameState).phase === 'reveal') {
        emitRevealResults(io, state);
      }
      io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    }
  });

  socket.on('update-collective-guess', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (state.settings.guessingMode !== 'collective') return;
    if (socket.id === state.currentRankerId) return;

    state.collectiveGuess = ranking;
    socket.to(state.lobbyCode).emit('collective-guess-updated', { ranking });
  });

  socket.on('lock-collective-guess', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (state.settings.guessingMode !== 'collective') return;
    if (!state.collectiveGuess) return;

    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  });

  socket.on('submit-authorship-guess', ({ guesses }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'authorship_guess') return;
    if (socket.id !== state.currentRankerId) return;

    state.authorshipGuesses = guesses;
    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));

    setTimeout(() => {
      const currentState = lobbies.get(state.lobbyCode);
      if (!currentState || currentState.phase !== 'authorship_reveal') return;
      advancePhase(currentState);
      io.to(currentState.lobbyCode).emit('phase-changed', toLobbyState(currentState));
    }, 8000);
  });

  socket.on('next-round', () => {
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

    setTimeout(() => {
      const currentState = lobbies.get(state.lobbyCode);
      if (!currentState) return;
      const p = currentState.players.get(socket.id);
      if (!p || p.connected) return;

      if (!currentState.submittedPlayerIds.has(socket.id)) {
        handleAutoSubmit(io, currentState, socket.id);
      }
    }, 30000);
  });
}

export function onPhaseChange(io: Server<ClientEvents, ServerEvents>, state: ServerGameState): void {
  if (state.phase === 'reveal') {
    emitRevealResults(io, state);
  } else if (state.phase === 'game_over') {
    emitGameOver(io, state);
  }
}
