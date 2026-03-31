import type { ServerGameState } from './lobby.js';
import { getAutoFillCards } from './cards.js';

export function startGame(state: ServerGameState): void {
  state.currentTurn = 1;
  startTurn(state);
}

export function startTurn(state: ServerGameState): void {
  const rankerIndex = (state.currentTurn - 1) % state.rankerOrder.length;
  state.currentRankerId = state.rankerOrder[rankerIndex];

  console.log(`Turn ${state.currentTurn}: Ranker is ${state.currentRankerId} (index ${rankerIndex})`);
  console.log(`Ranker order: ${state.rankerOrder.join(', ')}`);

  state.cards = [];
  state.rankerRanking = null;
  state.collectiveGuess = null;
  state.submittedPlayerIds = new Set();
  state.playerCardCounts = new Map();

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
      state.phase = 'ranking';
      break;
    }

    case 'ranking':
      state.collectiveGuess = state.cards.map((c) => c.id);
      state.phase = 'guessing';
      break;

    case 'guessing':
      state.phase = 'reveal';
      break;

    case 'reveal': {
      const totalTurns = state.settings.roundCount * state.rankerOrder.length;
      if (state.currentTurn < totalTurns) {
        state.currentTurn++;
        startTurn(state);
      } else {
        state.phase = 'game_over';
      }
      break;
    }
  }
}
