import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents, TurnResult } from '../../../shared/src/types.js';
import { getLobbyForSocket, toLobbyState, type ServerGameState, lobbies, socketToLobby } from '../lobby.js';
import { createPlayerCard } from '../cards.js';
import { startGame, advancePhase } from '../game.js';
import { calculateScore } from '../scoring.js';

function emitRevealResults(io: Server<ClientEvents, ServerEvents>, state: ServerGameState): void {
  const trueRanking = state.rankerRanking!;
  const rankerId = state.currentRankerId!;
  const turnScores: Record<string, number> = {};

  if (state.settings.individualGuessEnabled && state.individualGuesses) {
    // Score each guesser individually
    const guesserScores: number[] = [];
    for (const [playerId] of state.players) {
      if (playerId !== rankerId) {
        const guess = state.individualGuesses.get(playerId) ?? [];
        const score = guess.length > 0 ? calculateScore(trueRanking, guess, state.settings.nearMissScoring) : 0;
        turnScores[playerId] = score;
        state.scores.set(playerId, (state.scores.get(playerId) || 0) + score);
        guesserScores.push(score);
      }
    }
    // Ranker stat: mean of all guesser scores
    if (guesserScores.length > 0) {
      const mean = guesserScores.reduce((a, b) => a + b, 0) / guesserScores.length;
      if (!state.rankerStats.has(rankerId)) {
        state.rankerStats.set(rankerId, []);
      }
      state.rankerStats.get(rankerId)!.push(mean);
    }
  } else if (state.collectiveGuess) {
    // Score collective guess (guessers)
    const score = calculateScore(trueRanking, state.collectiveGuess, state.settings.nearMissScoring);
    for (const [playerId] of state.players) {
      if (playerId !== rankerId) {
        turnScores[playerId] = score;
        state.scores.set(playerId, (state.scores.get(playerId) || 0) + score);
      }
    }
    if (!state.rankerStats.has(rankerId)) {
      state.rankerStats.set(rankerId, []);
    }
    state.rankerStats.get(rankerId)!.push(score);
  }

  // Score authorship guesses (ranker)
  let authorshipScore = 0;
  const authorshipResults: Record<string, string> | null = state.settings.authorshipEnabled
    ? Object.fromEntries(state.cards.map((c) => [c.id, c.authorId ?? 'auto']))
    : null;

  if (state.settings.authorshipEnabled && state.authorshipGuesses && authorshipResults) {
    for (const [cardId, trueAuthor] of Object.entries(authorshipResults)) {
      if (state.authorshipGuesses[cardId] === trueAuthor) {
        authorshipScore++;
      }
    }
    state.scores.set(rankerId, (state.scores.get(rankerId) || 0) + authorshipScore);
    state.authorshipScores.set(rankerId, (state.authorshipScores.get(rankerId) || 0) + authorshipScore);
    turnScores[rankerId] = authorshipScore;
  }

  const playerNames: Record<string, string> = {};
  for (const [id, player] of state.players) {
    playerNames[id] = player.displayName;
  }

  const result: TurnResult = {
    turnNumber: state.currentTurn,
    rankerId,
    cards: state.cards.map((c) => ({ id: c.id, text: c.text })),
    trueRanking,
    collectiveGuess: state.settings.individualGuessEnabled ? null : state.collectiveGuess,
    individualGuesses: state.settings.individualGuessEnabled ? Object.fromEntries(state.individualGuesses!) : null,
    scores: turnScores,
    totalScores: Object.fromEntries(state.scores),
    playerNames,
    authorshipGuesses: state.authorshipGuesses,
    authorshipResults,
    authorshipScore,
    funniestCardId: null,
    funniestCardWinnerId: null,
  };

  state.turnHistory.push(result);
  io.to(state.lobbyCode).emit('reveal-results', result);
}

export function buildGameOverData(state: ServerGameState): import('../../../shared/src/types.js').GameOverData {
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

  let bestAuthorshipGuesser: { playerId: string; totalScore: number } | null = null;
  for (const [playerId, score] of state.authorshipScores) {
    if (score > 0 && (!bestAuthorshipGuesser || score > bestAuthorshipGuesser.totalScore)) {
      bestAuthorshipGuesser = { playerId, totalScore: score };
    }
  }

  return {
    finalScores,
    turnHistory: state.turnHistory,
    superlatives: { mostPredictable, leastPredictable, bestAuthorshipGuesser },
  };
}

function emitGameOver(io: Server<ClientEvents, ServerEvents>, state: ServerGameState): void {
  io.to(state.lobbyCode).emit('game-over', buildGameOverData(state));
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
      if (!state.playerCardCounts.get(playerId)) {
        // hasn't submitted any card yet — auto-submit a placeholder
        state.cards.push(createPlayerCard('...', playerId));
        state.playerCardCounts.set(playerId, 1);
      }
      // mark as done regardless of mode
      state.submittedPlayerIds.add(playerId);
      io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
      checkPhaseAdvance(io, state);
    }
    return;
  }

  if (state.phase === 'authorship_guess' && playerId === state.currentRankerId) {
    // Auto-submit random guesses so game can continue
    const playerIds = Array.from(state.players.keys()).filter((id) => id !== state.currentRankerId);
    const guesses: Record<string, string> = {};
    for (const card of state.cards) {
      const options = [...playerIds, 'auto'];
      guesses[card.id] = options[Math.floor(Math.random() * options.length)];
    }
    state.authorshipGuesses = guesses;
    advancePhase(state); // -> authorship_reveal
    advancePhase(state); // -> ranking (skip the manual reveal step when auto-submitting)
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
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
      if (state.settings.individualGuessEnabled && state.individualGuesses) {
        const shuffled = [...state.cards.map((c) => c.id)].sort(() => Math.random() - 0.5);
        state.individualGuesses.set(playerId, shuffled);
      }
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

    const nonRankerCount = state.players.size - 1;
    const poolSize = Math.max(0, 5 - nonRankerCount);
    const extraCardsInPool = state.cards.filter(c => c.authorId !== null).length - nonRankerCount;

    if (state.settings.multipleSubmissionsEnabled) {
      if (extraCardsInPool >= poolSize) return; // pool full
    } else {
      if (state.cards.some(c => c.authorId === socket.id)) return; // already submitted one
    }

    state.cards.push(createPlayerCard(text, socket.id));
    state.playerCardCounts.set(socket.id, (state.playerCardCounts.get(socket.id) || 0) + 1);

    if (!state.settings.multipleSubmissionsEnabled) {
      state.submittedPlayerIds.add(socket.id);
      io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });
    } else {
      // If pool is now full, auto-mark all guessers who have submitted at least one card as done
      const extraCardsNow = state.cards.filter(c => c.authorId !== null).length - nonRankerCount;
      if (extraCardsNow >= poolSize) {
        for (const [id] of state.players) {
          if (id !== state.currentRankerId && state.playerCardCounts.get(id) && !state.submittedPlayerIds.has(id)) {
            state.submittedPlayerIds.add(id);
          }
        }
      }
    }

    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
    checkPhaseAdvance(io, state);
  });

  socket.on('done-submitting', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'card_submission') return;
    if (socket.id === state.currentRankerId) return;
    if (!state.settings.multipleSubmissionsEnabled) return;
    if (state.submittedPlayerIds.has(socket.id)) return;
    if (!state.playerCardCounts.get(socket.id)) return; // must have submitted at least one

    state.submittedPlayerIds.add(socket.id);
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
    checkPhaseAdvance(io, state);
  });

  socket.on('submit-authorship', ({ guesses }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'authorship_guess') return;
    if (socket.id !== state.currentRankerId) return;
    if (Object.keys(guesses).length !== state.cards.length) return;

    state.authorshipGuesses = guesses;
    advancePhase(state); // -> authorship_reveal
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  });

  socket.on('continue-to-ranking', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'authorship_reveal') return;
    if (socket.id !== state.hostId) return;

    advancePhase(state); // -> ranking
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
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

  socket.on('submit-individual-guess', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (!state.settings.individualGuessEnabled) return;
    if (socket.id === state.currentRankerId) return;
    if (state.submittedPlayerIds.has(socket.id)) return;
    if (ranking.length !== 5) return;

    state.individualGuesses!.set(socket.id, ranking);
    state.submittedPlayerIds.add(socket.id);
    io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });

    const nonRankerCount = state.players.size - 1;
    if (state.submittedPlayerIds.size >= nonRankerCount) {
      advancePhase(state);
      emitRevealResults(io, state);
      io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    }
  });

  socket.on('update-collective-guess', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (state.settings.individualGuessEnabled) return;
    if (socket.id === state.currentRankerId) return;
    if (state.submittedPlayerIds.size > 0) return;

    state.collectiveGuess = ranking;
    io.to(state.lobbyCode).emit('collective-guess-updated', { ranking });
  });

  socket.on('unlock-collective-guess', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (state.settings.individualGuessEnabled) return;
    if (socket.id === state.currentRankerId) return;
    if (!state.submittedPlayerIds.has(socket.id)) return;

    state.submittedPlayerIds.delete(socket.id);
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });

  socket.on('lock-collective-guess', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (state.settings.individualGuessEnabled) return;
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

  socket.on('submit-funniest-card', ({ cardId }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'reveal') return;
    if (state.settings.funniestCardMode === 'off') return;

    const isRanker = socket.id === state.currentRankerId;

    if (state.settings.funniestCardMode === 'ranker') {
      // Only the ranker can pick
      if (!isRanker) return;
    } else {
      // vote mode — anyone can vote, one vote each
      if (state.funniestCardVotes.has(socket.id)) return;
    }

    // Validate the card exists
    if (!state.cards.find((c) => c.id === cardId)) return;

    const resolveFunniest = (resolvedCardId: string | null, winnerId: string | null) => {
      if (winnerId) {
        state.scores.set(winnerId, (state.scores.get(winnerId) || 0) + 1);
      }
      // Always mark as resolved on the stored TurnResult so the host can proceed
      const lastResult = state.turnHistory[state.turnHistory.length - 1];
      if (lastResult) {
        // Use 'tie' sentinel when there's no winning card, so null stays meaning "not yet resolved"
        lastResult.funniestCardId = resolvedCardId ?? 'tie';
        lastResult.funniestCardWinnerId = winnerId;
        lastResult.totalScores = Object.fromEntries(state.scores);
        if (winnerId) {
          lastResult.scores[winnerId] = (lastResult.scores[winnerId] || 0) + 1;
        }
      }
      io.to(state.lobbyCode).emit('funniest-card-result', {
        cardId: resolvedCardId,
        winnerId,
        scores: Object.fromEntries(state.scores),
      });
    };

    if (state.settings.funniestCardMode === 'ranker') {
      // Ranker picks immediately — resolve now
      const card = state.cards.find((c) => c.id === cardId)!;
      const winnerId = card.authorId ?? null; // null means auto-generated — no winner
      resolveFunniest(cardId, winnerId);
    } else {
      // vote mode — record vote and broadcast progress
      state.funniestCardVotes.set(socket.id, cardId);
      io.to(state.lobbyCode).emit('funniest-votes-updated', {
        votes: Object.fromEntries(state.funniestCardVotes),
      });

      // Resolve when all connected players have voted
      const connectedPlayerIds = Array.from(state.players.values())
        .filter((p) => p.connected)
        .map((p) => p.id);
      const allVoted = connectedPlayerIds.every((id) => state.funniestCardVotes.has(id));

      if (allVoted) {
        // Tally votes
        const tally = new Map<string, number>();
        for (const vid of state.funniestCardVotes.values()) {
          tally.set(vid, (tally.get(vid) || 0) + 1);
        }
        const maxVotes = Math.max(...tally.values());
        const topCards = [...tally.entries()].filter(([, v]) => v === maxVotes).map(([k]) => k);
        const winningCardId = topCards.length === 1 ? topCards[0] : null;
        const winningCard = winningCardId ? state.cards.find((c) => c.id === winningCardId) : null;
        const winnerId = winningCard?.authorId ?? null;
        resolveFunniest(winningCardId, winnerId);
      }
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
    state.individualGuesses = null;
    state.authorshipGuesses = null;
    state.funniestCardVotes = new Map();
    state.submittedPlayerIds = new Set();
    state.turnHistory = [];
    state.rankerStats = new Map();
    state.authorshipScores = new Map();
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

    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));

    const timer = setTimeout(() => {
      const currentState = lobbies.get(state.lobbyCode);
      if (!currentState) return;
      const p = currentState.players.get(socket.id);
      if (!p || p.connected) return;

      if (currentState.phase === 'lobby') {
        // Grace period expired — fully remove the player from the lobby
        currentState.players.delete(socket.id);
        currentState.rankerOrder = currentState.rankerOrder.filter((id) => id !== socket.id);
        currentState.scores.delete(socket.id);
        socketToLobby.delete(socket.id);

        if (currentState.hostId === socket.id && currentState.players.size > 0) {
          const newHost = Array.from(currentState.players.values()).find((pl) => pl.connected);
          if (newHost) {
            newHost.isHost = true;
            currentState.hostId = newHost.id;
          }
        }

        if (currentState.players.size === 0) {
          lobbies.delete(currentState.lobbyCode);
          return;
        }

        io.to(currentState.lobbyCode).emit('lobby-updated', toLobbyState(currentState));
        return;
      }

      if (currentState.hostId === socket.id) {
        const nextConnected = Array.from(currentState.players.values()).find(
          (pl) => pl.id !== socket.id && pl.connected
        );
        if (nextConnected) {
          const oldHost = currentState.players.get(socket.id);
          if (oldHost) oldHost.isHost = false;
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
