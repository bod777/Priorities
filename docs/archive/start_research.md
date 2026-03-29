# Game Start & Round Initialization - Deep Analysis

## Overview

This document provides a comprehensive analysis of how the game starts, how rankers are selected, and how the card submission phase works in the Priorities game.

---

## 1. Game Start Flow

### 1.1 Trigger Point

**Location**: `server/src/handlers/gameHandlers.ts:127-134`

```typescript
socket.on('start-game', () => {
  const state = getLobbyForSocket(socket.id);
  if (!state || state.hostId !== socket.id) return;  // Host-only check
  if (state.players.size < 3) return;                 // Minimum 3 players

  startGame(state);
  io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
});
```

**Requirements**:
- Only the host can start the game
- Minimum 3 players required
- Game must be in `lobby` phase (implicit check in startGame)

---

## 2. Game Initialization (`startGame`)

**Location**: `server/src/game.ts:4-15`

### 2.1 Player Order Randomization

```typescript
const playerIds = Array.from(state.players.keys());
const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
state.rankerOrder = shuffled;
```

**Key Details**:
1. Extracts all player socket IDs from the `players` Map
2. Creates a shuffled copy using random sort
3. Stores this shuffled order in `state.rankerOrder`
4. **This order determines who will be ranker in each round**

**Example**:
- Original players: `[player1, player2, player3, player4]`
- After shuffle: `[player3, player1, player4, player2]`
- Round 1 ranker: `player3`
- Round 2 ranker: `player1`
- Round 3 ranker: `player4`
- Round 4 ranker: `player2`
- Round 5 ranker: `player3` (wraps around)

### 2.2 Round Count Configuration

```typescript
if (state.settings.roundCount === 0) {
  state.settings.roundCount = playerIds.length;
}
```

**Logic**:
- If roundCount is explicitly set (e.g., 3 rounds), use that value
- If roundCount is 0, default to number of players (so each player is ranker once)

### 2.3 Initialize First Round

```typescript
state.currentRound = 1;
startRound(state);
```

Sets current round to 1 and calls `startRound()` to begin.

---

## 3. Round Start (`startRound`)

**Location**: `server/src/game.ts:17-30`

### 3.1 Ranker Selection Algorithm

```typescript
const rankerIndex = (state.currentRound - 1) % state.rankerOrder.length;
state.currentRankerId = state.rankerOrder[rankerIndex];
```

**How It Works**:

| Round | Calculation | Index | Ranker |
|-------|-------------|-------|--------|
| 1 | (1-1) % 4 = 0 | 0 | rankerOrder[0] |
| 2 | (2-1) % 4 = 1 | 1 | rankerOrder[1] |
| 3 | (3-1) % 4 = 2 | 2 | rankerOrder[2] |
| 4 | (4-1) % 4 = 3 | 3 | rankerOrder[3] |
| 5 | (5-1) % 4 = 0 | 0 | rankerOrder[0] ← wraps |
| 6 | (6-1) % 4 = 1 | 1 | rankerOrder[1] |

**Key Insight**: Using modulo ensures:
- Fair rotation through all players
- Wraps around if rounds exceed player count
- Deterministic (same order every time unless players leave/join)

### 3.2 State Reset

```typescript
state.cards = [];
state.rankerRanking = null;
state.guesses = new Map();
state.collectiveGuess = null;
state.authorshipGuesses = null;
state.personalRankings = new Map();
state.submittedPlayerIds = new Set();
```

**All round-specific data is cleared**:
- `cards[]`: Submitted cards for this round
- `rankerRanking`: Ranker's final ranking (null until submitted)
- `guesses`: Individual player guesses (Map<playerId, ranking[]>)
- `collectiveGuess`: Group's collaborative guess
- `authorshipGuesses`: Who wrote which card guesses
- `personalRankings`: Each player's personal ranking
- `submittedPlayerIds`: Tracks who has submitted in current phase

### 3.3 Phase Transition

```typescript
state.phase = 'card_submission';
```

**Immediately transitions to card submission phase**. No intermediate state.

---

## 4. Card Submission Phase

### 4.1 Server-Side Handler

**Location**: `server/src/handlers/gameHandlers.ts:136-150`

```typescript
socket.on('submit-card', ({ text }) => {
  const state = getLobbyForSocket(socket.id);
  if (!state || state.phase !== 'card_submission') return;
  if (socket.id === state.currentRankerId) return;  // ← RANKER CANNOT SUBMIT
  if (state.submittedPlayerIds.has(socket.id)) return;  // Prevent double-submit

  state.cards.push(createPlayerCard(text, socket.id));
  state.submittedPlayerIds.add(socket.id);

  io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });

  const nonRankerCount = state.players.size - 1;
  if (state.submittedPlayerIds.size >= nonRankerCount) {
    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  }
});
```

**Validation Checks**:
1. ✅ Lobby exists for this socket
2. ✅ Phase is `card_submission`
3. ✅ **Socket is NOT the current ranker** ← Critical!
4. ✅ Player hasn't already submitted

**Submission Flow**:
1. Create card with text and author ID
2. Add to `state.cards[]`
3. Mark player as submitted
4. Broadcast to all players that someone submitted
5. Check if all non-rankers have submitted
6. If yes → advance to next phase

### 4.2 Auto-Fill After All Submissions

**Location**: `server/src/game.ts:36-42` (in `advancePhase`)

```typescript
case 'card_submission': {
  const needed = 5 - state.cards.length;
  if (needed > 0) {
    const autoCards = getAutoFillCards(needed, state.cards.map((c) => c.text));
    state.cards.push(...autoCards);
  }
  state.cards.sort(() => Math.random() - 0.5);  // Shuffle cards

  // Transition to authorship_guess or ranking based on settings
}
```

**Auto-Fill Logic**:
- **Target**: Always 5 cards total
- If players submitted < 5 cards, fill remaining with random cards from pool
- **Author ID for auto-filled cards**: `null` (distinguishes them from player cards)
- Cards are shuffled so players can't deduce authorship by position

### 4.3 Client-Side View

**Location**: `client/src/screens/CardSubmission.tsx`

#### Current Implementation Issues:

**Problem 1: No Ranker Check**
```typescript
const hasSubmitted = lobbyState.submittedPlayerIds.includes(playerId);
```

❌ **Missing**:
```typescript
const isRanker = lobbyState.currentRankerId === playerId;
```

The UI doesn't differentiate between:
- **Ranker**: Should see "You are the ranker! Wait for others to submit cards"
- **Non-ranker**: Should see input field to submit a card

**Problem 2: Wrong Submission Count**
```typescript
{lobbyState.submittedPlayerIds.length} / {lobbyState.players.length} players ready
```

❌ **Should be**:
```typescript
{lobbyState.submittedPlayerIds.length} / {lobbyState.players.length - 1} players ready
```

Because ranker doesn't submit, so denominator should exclude them.

**Problem 3: Single Card Submission**
```typescript
const [cardTexts, setCardTexts] = useState<string[]>([]);
```

Currently only submits 1 card, but the state structure suggests multiple cards per player was considered in planning.

---

## 5. State Lifecycle

### 5.1 ServerGameState Structure

**Location**: `server/src/lobby.ts:5-24`

```typescript
export interface ServerGameState {
  lobbyCode: string;
  hostId: string;
  settings: GameSettings;
  players: Map<string, Player>;           // All players
  phase: GamePhase;
  currentRound: number;                   // 1-indexed
  rankerOrder: string[];                  // Shuffled player IDs
  currentRankerId: string | null;         // Current round's ranker
  cards: CardFull[];                      // Submitted + auto-fill cards
  rankerRanking: string[] | null;         // Ranker's submitted ranking
  guesses: Map<string, string[]>;         // playerId → ranking guess
  collectiveGuess: string[] | null;       // Shared guess in collective mode
  authorshipGuesses: Record<string, string> | null;  // cardId → guessed author
  personalRankings: Map<string, string[]>;  // playerId → personal ranking
  scores: Map<string, number>;            // Cumulative scores
  rankerStats: Map<string, number[]>;     // Tracks ranker predictability
  roundHistory: RoundResult[];            // Past round results
  submittedPlayerIds: Set<string>;        // Who submitted in current phase
}
```

### 5.2 State Transitions

```
lobby
  ↓ [start-game event]
card_submission (currentRankerId set, cards=[], submittedPlayerIds={})
  ↓ [all non-rankers submit OR timeout]
  ↓ [auto-fill to 5 cards, shuffle]
authorship_guess (if enabled) OR ranking
  ↓
authorship_reveal (if authorship enabled)
  ↓
ranking (ranker ranks the 5 cards)
  ↓
guessing (non-rankers guess ranker's order)
  ↓
personal_ranking (if enabled)
  ↓
reveal (scores calculated)
  ↓ [next-round OR game_over]
card_submission (next round, new ranker) OR game_over
```

---

## 6. Key Gotchas & Edge Cases

### 6.1 Ranker Cannot Submit Cards

**Server enforces**:
```typescript
if (socket.id === state.currentRankerId) return;
```

**Client should show**: Different UI for ranker vs non-ranker.

### 6.2 Submission Count Calculation

**Always exclude ranker**:
```typescript
const nonRankerCount = state.players.size - 1;
```

### 6.3 Player Order Persistence

`rankerOrder[]` is set once at game start and persists:
- Doesn't change between rounds
- If a player disconnects, their ID remains in order (but they'll be auto-submitted)
- If a player reconnects mid-game, they resume their position

### 6.4 Round Wrap-Around

If you have 4 players and 10 rounds:
- Rounds 1-4: Each player is ranker once
- Rounds 5-8: Each player is ranker again (same order)
- Rounds 9-10: First two players are ranker a third time

### 6.5 Auto-Fill Trigger

Auto-fill happens **after all submissions**, not during:
- If 3 players (2 non-rankers) both submit → 2 cards
- Auto-fill adds 3 more → 5 total
- If 6 players (5 non-rankers) all submit → 5 cards
- Auto-fill adds 0 → 5 total

### 6.6 Card Authorship Tracking

```typescript
export interface CardFull {
  id: string;          // UUID
  text: string;        // Card content
  authorId: string | null;  // null = auto-generated, else player ID
}
```

**Why track authorId**:
- Used in authorship guessing phase
- Revealed in reveal phase
- Auto-generated cards have `authorId: null`

---

## 7. Data Flow Diagram

```
[Host clicks "Start Game"]
         ↓
    start-game event
         ↓
[Server: startGame()]
    - Shuffle players → rankerOrder
    - Set roundCount (if 0)
    - currentRound = 1
         ↓
[Server: startRound()]
    - Calculate rankerIndex = (round-1) % players
    - Set currentRankerId = rankerOrder[rankerIndex]
    - Reset all round state
    - phase = 'card_submission'
         ↓
[Server emits: phase-changed]
         ↓
[All clients receive LobbyState]
    - currentRankerId: "socketId123"
    - phase: "card_submission"
    - submittedPlayerIds: []
         ↓
[Client: CardSubmission screen renders]
    - If playerId === currentRankerId:
        → Show "You are the ranker!"
    - Else:
        → Show card input
         ↓
[Non-ranker submits card]
         ↓
    submit-card event
         ↓
[Server validates & adds card]
    - cards.push(newCard)
    - submittedPlayerIds.add(playerId)
         ↓
[Server emits: player-submitted]
         ↓
[All clients update UI counter]
         ↓
[Last non-ranker submits]
         ↓
[Server: advancePhase()]
    - Auto-fill to 5 cards
    - Shuffle cards
    - phase = next phase
         ↓
[Server emits: phase-changed]
         ↓
[Clients transition to next screen]
```

---

## 8. Current Bugs Identified

### Bug 1: CardSubmission Doesn't Check if Player is Ranker

**File**: `client/src/screens/CardSubmission.tsx`

**Issue**: All players see the card input, including the ranker.

**Expected Behavior**:
- **Ranker**: See "You are the Ranker this round! Waiting for others..."
- **Non-ranker**: See card submission input

**Fix Required**:
```typescript
const isRanker = lobbyState.currentRankerId === playerId;

if (isRanker) {
  return <div>You are the ranker! Wait for {lobbyState.players.length - 1} players to submit.</div>
} else {
  // Show card submission UI
}
```

### Bug 2: Incorrect Player Count in Waiting Message

**File**: `client/src/screens/CardSubmission.tsx:66-67`

**Issue**:
```typescript
{lobbyState.submittedPlayerIds.length} / {lobbyState.players.length} players ready
```

Should be:
```typescript
{lobbyState.submittedPlayerIds.length} / {lobbyState.players.length - 1} players ready
```

Because the ranker doesn't submit a card.

### Bug 3: No Visual Indicator for Ranker

**Issue**: The ranker has no clear indication they are the ranker until they try to submit.

**Fix Required**: Add visual badge/banner at top of screen showing who the current ranker is.

---

## 9. Settings Impact on Round Start

### 9.1 Round Count

```typescript
settings.roundCount: number;
```

- `0`: Default to number of players (each is ranker once)
- `1-10`: Explicit number of rounds
- Affects when `game_over` phase triggers

### 9.2 Authorship Guess

```typescript
settings.authorshipGuess: boolean;
```

- `true`: After card submission → authorship_guess phase
- `false`: After card submission → ranking phase directly

### 9.3 Guessing Mode

```typescript
settings.guessingMode: 'collective' | 'individual';
```

- `collective`: All non-rankers collaborate on one guess
- `individual`: Each non-ranker submits their own guess

**Does NOT affect round start**, only guessing phase behavior.

### 9.4 Personal Ranking

```typescript
settings.personalRanking: boolean;
```

- `true`: After guessing → personal_ranking phase
- `false`: After guessing → reveal phase directly

**Does NOT affect round start**.

---

## 10. Recommendations

### 10.1 Immediate Fixes

1. **Add ranker check in CardSubmission.tsx**
2. **Fix player count calculation** (exclude ranker)
3. **Add visual ranker indicator** across all screens

### 10.2 UX Improvements

1. **Show ranker rotation preview** in lobby (who will be ranker each round)
2. **Add round transition animation** ("Round 2: Alice is the ranker!")
3. **Show ranker name** prominently during card submission
4. **Add estimated time remaining** for card submission

### 10.3 Technical Improvements

1. **Add server-side timeout** for card submission (e.g., 60 seconds)
2. **Auto-submit placeholder cards** for disconnected players
3. **Persist rankerOrder** to handle mid-game disconnects better
4. **Add lobby setting** for number of auto-fill cards (currently hardcoded to 5 total)

---

## Summary

The game start and round initialization flow is well-architected with:
- ✅ Fair ranker rotation using modulo arithmetic
- ✅ Proper state reset between rounds
- ✅ Server-side validation preventing ranker from submitting cards
- ✅ Auto-fill mechanism ensuring consistent 5-card gameplay

**Critical bugs** exist in the **client CardSubmission component** that don't account for the ranker role, leading to confusion. These need immediate fixes before the game is playable.
