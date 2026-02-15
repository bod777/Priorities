import type { ServerGameState } from './lobby.js';
import { getAutoFillCards } from './cards.js';

export function startGame(state: ServerGameState): void {
  const playerIds = Array.from(state.players.keys());
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  state.rankerOrder = shuffled;

  if (state.settings.roundCount === 0) {
    state.settings.roundCount = playerIds.length;
  }

  state.currentRound = 1;
  startRound(state);
}

export function startRound(state: ServerGameState): void {
  const rankerIndex = (state.currentRound - 1) % state.rankerOrder.length;
  state.currentRankerId = state.rankerOrder[rankerIndex];

  state.cards = [];
  state.rankerRanking = null;
  state.guesses = new Map();
  state.collectiveGuess = null;
  state.authorshipGuesses = null;
  state.personalRankings = new Map();
  state.submittedPlayerIds = new Set();

  state.phase = 'card_submission';
}

export function advancePhase(state: ServerGameState): void {
  state.submittedPlayerIds = new Set();

  switch (state.phase) {
    case 'card_submission': {
      const needed = 5 - state.cards.length;
      if (needed > 0) {
        const autoCards = getAutoFillCards(needed, state.cards.map((c) => c.text));
        state.cards.push(...autoCards);
      }
      state.cards.sort(() => Math.random() - 0.5);

      if (state.settings.authorshipGuess) {
        state.phase = 'authorship_guess';
      } else {
        state.phase = 'ranking';
      }
      break;
    }

    case 'authorship_guess':
      state.phase = 'authorship_reveal';
      break;

    case 'authorship_reveal':
      state.phase = 'ranking';
      break;

    case 'ranking':
      state.phase = 'guessing';
      break;

    case 'guessing':
      if (state.settings.personalRanking) {
        state.phase = 'personal_ranking';
      } else {
        state.phase = 'reveal';
      }
      break;

    case 'personal_ranking':
      state.phase = 'reveal';
      break;

    case 'reveal':
      if (state.currentRound < state.settings.roundCount) {
        state.currentRound++;
        startRound(state);
      } else {
        state.phase = 'game_over';
      }
      break;
  }
}
