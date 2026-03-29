# Collective Ranking System — Deep Dive

This document covers the full mechanics of how the ranking system works in Priorities, with particular focus on how players see each other's changes in real time.

---

## Table of Contents

1. [Game Phase Overview](#1-game-phase-overview)
2. [Roles: Ranker vs. Guessers](#2-roles-ranker-vs-guessers)
3. [Data Structures](#3-data-structures)
4. [Socket Events Reference](#4-socket-events-reference)
5. [Real-Time Update Flow](#5-real-time-update-flow)
6. [Collective Guess Mode — Step by Step](#6-collective-guess-mode--step-by-step)
7. [Individual Guess Mode — Step by Step](#7-individual-guess-mode--step-by-step)
8. [Progress Tracking (Who Has Submitted)](#8-progress-tracking-who-has-submitted)
9. [Phase Advancement Logic](#9-phase-advancement-logic)
10. [Scoring](#10-scoring)
11. [Reveal & Results](#11-reveal--results)
12. [Optional Phases](#12-optional-phases)
13. [Disconnection & Auto-Submit](#13-disconnection--auto-submit)
14. [State Synchronization Pattern](#14-state-synchronization-pattern)
15. [Game Over & Superlatives](#15-game-over--superlatives)

---

## 1. Game Phase Overview

The game flows through a strict sequence of phases defined in `shared/src/types.ts`:

```
lobby
  → card_submission
    → [authorship_guess]       (optional)
      → [authorship_reveal]    (optional)
        → ranking
          → guessing
            → [personal_ranking]  (optional)
              → reveal
                → (next round or game_over)
```

Phase transitions are driven entirely by the server. Clients never change their own phase — they always receive a `phase-changed` event with the new `LobbyState`.

---

## 2. Roles: Ranker vs. Guessers

Every round has exactly one **Ranker** and all other players are **Guessers**.

- The ranker order is determined once at game start by shuffling all player IDs randomly (`server/src/game.ts`).
- Each round uses `rankerOrder[(currentRound - 1) % rankerOrder.length]` to pick the current ranker.
- This ensures every player gets a turn and the rotation cycles for multi-round games.

**What the Ranker does:**
- Does NOT submit a card during `card_submission`
- Sees all cards during `ranking` and drags them into their true preferred order
- Submits the ranking, which becomes the "ground truth"
- Does NOT participate in `guessing` (cannot drag cards or lock a guess)
- MAY participate in `personal_ranking` (optional phase)

**What Guessers do:**
- Submit a card during `card_submission`
- Do NOT see the ranking phase (they wait while the ranker orders cards)
- Try to guess the ranker's order during `guessing`
- Earn 1 point per card placed in the correct position

---

## 3. Data Structures

### Server-Side State (`server/src/lobby.ts`)

```typescript
interface ServerGameState {
  lobbyCode: string;
  hostId: string;
  settings: GameSettings;
  players: Map<string, Player>;
  phase: GamePhase;
  currentRound: number;
  rankerOrder: string[];           // Shuffled player ID array for rotation
  currentRankerId: string | null;
  cards: CardFull[];               // 5 cards with author info
  rankerRanking: string[] | null;  // Ordered card IDs — the true ranking
  guesses: Map<string, string[]>;  // playerId → ordered card IDs
  collectiveGuess: string[] | null;// Shared working order (collective mode)
  authorshipGuesses: Record<string, string> | null;
  personalRankings: Map<string, string[]>;
  scores: Map<string, number>;     // Cumulative scores
  rankerStats: Map<string, number[]>; // Avg guesser scores per ranker
  roundHistory: RoundResult[];
  submittedPlayerIds: Set<string>; // Who has submitted in the current phase
}
```

### Client-Side State (`client/src/context/GameContext.tsx`)

Clients never hold the full server state. They receive a sanitized `LobbyState`:

```typescript
interface LobbyState {
  lobbyCode: string;
  hostId: string;
  settings: GameSettings;
  players: Player[];
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  currentRankerId: string | null;
  cards: CardPublic[];             // id + text only — no author info
  submittedPlayerIds: string[];    // For showing progress to all players
  collectiveGuessOrder: string[];  // Current live collective guess
}
```

**Important:** `cards` sent to clients only contain `{ id, text }`. The `authorId` is deliberately stripped so guessers cannot determine authorship from the network payload.

### Card Types

```typescript
// Server only — includes author
interface CardFull {
  id: string;
  text: string;
  authorId: string | null;  // null = auto-generated filler card
}

// Sent to clients
interface CardPublic {
  id: string;
  text: string;
}
```

---

## 4. Socket Events Reference

### Client → Server

| Event | Payload | Who can send | When |
|---|---|---|---|
| `submit-card` | `{ text: string }` | Non-rankers | `card_submission` phase |
| `submit-ranking` | `{ ranking: string[] }` | Ranker only | `ranking` phase |
| `submit-guess` | `{ ranking: string[] }` | Non-rankers | `guessing` phase (individual mode) |
| `update-collective-guess` | `{ ranking: string[] }` | Non-rankers | `guessing` phase (collective mode) |
| `lock-collective-guess` | _(none)_ | Non-rankers | `guessing` phase (collective mode) |
| `submit-authorship-guess` | `{ guesses: Record<string, string> }` | Ranker only | `authorship_guess` phase |
| `submit-personal-ranking` | `{ ranking: string[] }` | All players | `personal_ranking` phase |
| `next-round` | _(none)_ | Host only | `reveal` phase |

### Server → Client

| Event | Payload | Sent to | Meaning |
|---|---|---|---|
| `lobby-updated` | `LobbyState` | All players | Non-phase-changing state update |
| `phase-changed` | `LobbyState` | All players | Phase has advanced |
| `player-submitted` | `{ playerId: string }` | All players | A player just submitted |
| `collective-guess-updated` | `{ ranking: string[] }` | All OTHER players | Someone moved a card (collective) |
| `reveal-results` | `RoundResult` | All players | Scores and true ranking revealed |
| `game-over` | `GameOverData` | All players | Final scores and superlatives |
| `error` | `{ message: string }` | Sender only | Validation failure |

---

## 5. Real-Time Update Flow

There are two distinct real-time mechanisms:

### Mechanism A — Full State Broadcasts

Used for phase transitions and major state changes. The server calls `toLobbyState(state)` and emits `phase-changed` or `lobby-updated` to the entire lobby room via `io.to(state.lobbyCode).emit(...)`.

Every client replaces its entire `lobbyState` with the received data. This is the source of truth for: current phase, current ranker, which players have submitted, and the current collective guess order.

### Mechanism B — Targeted Delta Events

Used for high-frequency updates where broadcasting the full state would be wasteful.

**`player-submitted`** — emitted whenever any player completes their submission in the current phase. All clients use this to update a progress indicator without waiting for a full state sync.

**`collective-guess-updated`** — the most latency-sensitive event. Emitted by the server every time a non-ranker drags a card in collective mode. Contains only the new card order array. The server does NOT broadcast back to the sender — it uses `socket.to(lobbyCode).emit(...)` (the `to` instead of `io.to` skips the sender). This means:

- The player who dragged sees their own change immediately (local state update)
- All other players receive the updated order within one round-trip

---

## 6. Collective Guess Mode — Step by Step

Collective mode is enabled when `settings.guessingMode === 'collective'`. All non-ranker players collaborate on a single shared ranking.

### 6.1 Entering the Guessing Phase

When the ranker submits their ranking (`submit-ranking`), the server advances the phase to `guessing` and broadcasts `phase-changed` with a `LobbyState`. The `collectiveGuessOrder` field in that state is either:
- Empty array `[]` (first guess of the game), or
- The current value of `state.collectiveGuess` if it was already set

All clients render `CollectiveGuess` screen. The ranker sees the screen but cannot interact (all controls are disabled for them).

### 6.2 Real-Time Card Dragging

When any non-ranker drags a card to a new position:

1. Client calls `socket.emit('update-collective-guess', { ranking: newOrder })` immediately after the drag ends
2. Server handler (`gameHandlers.ts:208–216`) validates:
   - Player is in a lobby
   - Phase is `guessing`
   - Mode is `collective`
   - Sender is NOT the current ranker
3. If valid: `state.collectiveGuess = ranking` (overwrites the previous order)
4. Server emits `collective-guess-updated` to ALL OTHER players in the room
5. Other clients receive the event and update their local card order to match

There is no debounce or batching — every drag end triggers a socket event. This means if two players drag simultaneously, the last event to arrive at the server wins and overwrites the other.

### 6.3 The Lock Mechanic

Any non-ranker can "lock" the collective guess at any time by clicking a lock button. This emits `lock-collective-guess`.

Server handler (`gameHandlers.ts`):
1. Adds the sender to `submittedPlayerIds`
2. Saves the current `collectiveGuess` (whatever order is set at that moment)
3. Emits `player-submitted` to all players (so they see the lock count go up)
4. Checks if all non-rankers have locked — if so, advances to the next phase

**Key behavior:** The collective order keeps updating from drags even after some players have locked. A player who locks early does not freeze the order for everyone — they're just confirming they're done with it. The final order used for scoring is whatever `state.collectiveGuess` is when the last player locks.

### 6.4 What the Ranker Sees

The ranker's `CollectiveGuess` screen shows:
- The live card order updating in real time (they receive `collective-guess-updated` events)
- No ability to drag cards
- No lock button
- A "Waiting for others..." indicator showing how many players have locked

This lets the ranker watch the group's collaborative guessing process unfold in real time.

### 6.5 State Received on Join / Reconnect

If a player joins mid-game or reconnects, the `lobby-updated` event they receive includes the current `collectiveGuessOrder` in the `LobbyState`. They immediately see the current state of the collective ranking without needing to catch up on missed `collective-guess-updated` events.

---

## 7. Individual Guess Mode — Step by Step

When `settings.guessingMode === 'individual'`, each player submits their own independent guess.

1. All non-rankers see their own `RankingBoard` (drag-and-drop list of cards)
2. Each player arranges cards as they see fit — no changes are broadcast to others
3. When a player clicks "Submit Guess," the client emits `submit-guess` with their ordered card ID array
4. Server stores the guess in `state.guesses` (a Map from playerId to card ID array)
5. Server adds the player to `submittedPlayerIds` and emits `player-submitted` to all players
6. The submitting player's UI locks (no more dragging)
7. Other players see the progress count increase but cannot see each other's orderings
8. When all non-rankers have submitted, the server advances the phase

In individual mode, rankings are completely private until the reveal.

---

## 8. Progress Tracking (Who Has Submitted)

The `submittedPlayerIds` array in `LobbyState` is visible to all players and drives progress UI across all phases.

When a player submits in any phase:
- Server adds their ID to the `submittedPlayerIds` Set
- Server emits `player-submitted: { playerId }` immediately (fast path)
- The next full `phase-changed` event will also reflect this in `submittedPlayerIds`

UI components use this to show things like:
- "3 / 4 players have submitted cards"
- "Waiting for: Alice, Bob" (by comparing all player IDs to submitted IDs)
- Lock count in collective mode

The `submittedPlayerIds` Set is reset to empty at the start of each new phase.

---

## 9. Phase Advancement Logic

The server calls `checkPhaseAdvance` after every submission event. The logic varies by phase:

| Phase | Advances when |
|---|---|
| `card_submission` | All non-rankers have submitted a card |
| `authorship_guess` | Ranker submits authorship guesses (immediate) |
| `authorship_reveal` | Auto-advances after 8 seconds |
| `ranking` | Ranker submits their ranking (immediate) |
| `guessing` (individual) | All non-rankers have submitted a guess |
| `guessing` (collective) | All non-rankers have locked their collective guess |
| `personal_ranking` | ALL players (including ranker) have submitted |
| `reveal` | Host clicks "Next Round" |

The `advancePhase` function in `server/src/game.ts` handles the transition, including:
- Resetting `submittedPlayerIds`
- Setting the new phase value
- Computing auto-fill cards if needed (when going from `card_submission` to next phase)
- Shuffling cards before they're sent to clients

When `advancePhase` sets the phase to `reveal`, the server calls `emitRevealResults` before emitting `phase-changed`. This means clients receive `reveal-results` (with scores) before they receive the `phase-changed` event telling them to show the reveal screen.

---

## 10. Scoring

Scoring is calculated in `server/src/scoring.ts` immediately when the guessing phase ends.

### Position Match Scoring

```typescript
function calculateScore(trueRanking: string[], guessedRanking: string[]): number {
  let score = 0;
  for (let i = 0; i < 5; i++) {
    if (trueRanking[i] === guessedRanking[i]) score++;
  }
  return score;  // 0–5 points
}
```

One point per card in the exact correct position. No partial credit for "close" positions.

### Individual Mode

Each player's guess is scored independently. Each player's score is stored separately.

### Collective Mode

The single shared `collectiveGuess` order is scored once. Every non-ranker receives the same score for that round.

### Authorship Scoring (optional)

If `settings.authorshipGuess` is enabled, the ranker earns bonus points by correctly identifying which player wrote each card (or identifying auto-generated cards as "auto"). Scored separately from the ranking score and tracked on the `RoundResult`.

### Ranker Stats

After scoring, the ranker's entry in `state.rankerStats` receives the average score from this round's guessers. This tracks how "predictable" each ranker is over time.

---

## 11. Reveal & Results

When the `reveal` phase begins:

1. Server emits `reveal-results` with a `RoundResult` object containing:
   - The true ranking (ordered card IDs)
   - All individual guesses
   - The collective guess (if applicable)
   - Round scores per player
   - Authorship data (if applicable)
   - Personal rankings (if applicable)

2. Server then emits `phase-changed` with `phase: 'reveal'`

3. Client stores the `RoundResult` in context and renders the `Reveal` screen

The reveal screen animates cards appearing one by one from rank 5 to rank 1 (bottom to top). The animation uses a countdown timer and reveals each card with a fade/slide transition.

The host sees a "Next Round" button. All other players wait. When the host clicks it, the server either:
- Starts a new round (if `currentRound < totalRounds`)
- Emits `game-over` (if all rounds are done)

---

## 12. Optional Phases

### Authorship Guess / Reveal

Enabled via `settings.authorshipGuess`. Only runs if there are at least some non-auto-generated cards.

- During `authorship_guess`: Ranker sees all 5 cards and guesses who wrote each one (including "auto" as an option)
- Server advances immediately when ranker submits
- During `authorship_reveal`: All players see which guesses were correct. Auto-advances after 8 seconds
- Authorship score is added to the `RoundResult` but tracked separately from the main ranking score

### Personal Ranking

Enabled via `settings.personalRanking`.

- After `guessing`, ALL players (including the ranker) rank the cards according to their own personal preference
- This is distinct from guessing the ranker's order — it's about how each player themselves would rank
- Results are stored in `personalRankings` on the `RoundResult` and displayed on the reveal screen
- Personal rankings do NOT affect scores; they're for discussion and comparison

---

## 13. Disconnection & Auto-Submit

When a player disconnects (`socket.on('disconnect', ...)`):

1. Player is marked `connected: false` in `state.players`
2. If in `lobby` phase: player is fully removed from the lobby
3. If in any game phase: player stays in the game but is marked disconnected
4. `lobby-updated` is emitted to all remaining players
5. A 30-second timer is set

After 30 seconds, if the player has NOT reconnected:
- If in `card_submission`: a filler card with text `"..."` is auto-submitted for them
- If in `guessing` (individual mode): a random card order is submitted for them
- In both cases, the player is added to `submittedPlayerIds` so the game can advance

There is no auto-submit for the ranker. If the ranker disconnects during `ranking`, the game stalls until they reconnect or the host handles it.

---

## 14. State Synchronization Pattern

The server uses a "full state on change" approach for major events, supplemented by targeted delta events for high-frequency updates.

### `toLobbyState` — The Serializer

Every time a `phase-changed` or `lobby-updated` is sent, the server calls `toLobbyState(state)` which:
- Converts `Map<string, Player>` to `Player[]`
- Converts `Set<string>` submittedPlayerIds to `string[]`
- Strips author info from cards (only sends `{ id, text }`)
- Copies `collectiveGuess ?? []` as `collectiveGuessOrder`

This means clients always have a consistent, complete snapshot of the shared state after any phase event.

### Client Reducer

The GameContext reducer in `client/src/context/GameContext.tsx` handles:
- `SET_LOBBY` — replaces entire `lobbyState` (from `phase-changed` or `lobby-updated`)
- `SET_ROUND_RESULT` — stores the `RoundResult` for the reveal screen
- `SET_GAME_OVER` — stores game over data
- `SHOW_ROUND_TRANSITION` / `HIDE_ROUND_TRANSITION` — controls round transition animation

The round transition animation fires when phase changes TO `card_submission`, showing a brief interstitial before the card submission screen appears. A 3-second timeout then hides the transition.

### Who Renders What

The `GameRouter` component in `App.tsx` switches on `lobbyState.phase` to render the correct screen. The routing is:

```
lobby              → Lobby
card_submission    → CardSubmission (after RoundTransition animation)
ranking            → Ranking
guessing           → Guessing or CollectiveGuess (based on settings)
authorship_guess   → AuthorshipGuess
authorship_reveal  → AuthorshipReveal
personal_ranking   → PersonalRanking
reveal             → Reveal
game_over          → GameOver
```

All screens derive their data from `lobbyState` (the shared state) and `roundResult` (for the reveal screen). No screen holds local state that affects other players — all persistent changes go through the server.

---

## 15. Game Over & Superlatives

After the final round's `reveal` phase, the host's "Next Round" click triggers `emitGameOver`.

The server calculates three superlatives:

**Most Predictable Ranker** — the player whose ranker turns produced the highest average score across all guessers. High average = guessers got many positions right = ranker is easy to predict.

**Least Predictable Ranker** — the player whose ranker turns produced the lowest average score. Low average = guessers got few positions right = ranker is surprising/unpredictable.

**Best Guesser** — the player with the highest cumulative total score across all rounds.

The `game-over` event payload:
```typescript
interface GameOverData {
  finalScores: Record<string, number>;   // Total scores per player
  roundHistory: RoundResult[];           // All round results
  superlatives: {
    mostPredictable: { playerId: string; avgScore: number } | null;
    leastPredictable: { playerId: string; avgScore: number } | null;
    bestGuesser: { playerId: string; totalScore: number } | null;
  };
}
```

Note: A player who was only ever a guesser (never a ranker) will not appear in `mostPredictable` or `leastPredictable`. A player who was only ever a ranker will have a score of 0 and will not be `bestGuesser` unless all guessers also scored 0.

---

## Summary: The Collective Ranking Real-Time Loop

For collective mode specifically, here is the complete event loop:

```
[Ranker submits ranking]
        ↓
server: phase = 'guessing', emit phase-changed to all
        ↓
All clients render CollectiveGuess screen
Cards start in shuffled order (collectiveGuessOrder from LobbyState)
        ↓
[Non-ranker A drags card]
        ↓
Client A: socket.emit('update-collective-guess', { ranking: newOrder })
        ↓
Server: state.collectiveGuess = newOrder
Server: socket.to(lobbyCode).emit('collective-guess-updated', { ranking: newOrder })
        ↓
Client B, C, D (everyone except A): update their displayed card order
Client A: already shows the new order (local state, no need to wait)
        ↓
[This cycle repeats for every drag from any player]
        ↓
[Non-ranker clicks Lock]
        ↓
Client: socket.emit('lock-collective-guess')
        ↓
Server: submittedPlayerIds.add(playerId)
Server: io.to(lobbyCode).emit('player-submitted', { playerId })
        ↓
All clients: show updated lock count
        ↓
[When all non-rankers have locked]
        ↓
Server: advance phase → reveal
Server: emitRevealResults (scores based on final collectiveGuess order)
Server: io.to(lobbyCode).emit('reveal-results', result)
Server: io.to(lobbyCode).emit('phase-changed', { phase: 'reveal', ... })
        ↓
All clients: show Reveal screen with animated ranking
```
