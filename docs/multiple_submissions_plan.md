# Multiple Card Submissions Plan

## Overview

When enabled by the host, guessers can submit more than one card during the `card_submission` phase. The pool of cards to fill is `5 - nonRankerCount`. Each guesser may submit as many cards as they like into this shared pool, but no one is required to submit more than one. When a guesser is done contributing they press **Done**. Once all guessers have pressed Done, any remaining slots in the pool are auto-filled.

### Examples
| Guessers | Pool to fill | Each guesser must submit | Each guesser may submit up to |
|---|---|---|---|
| 4 | 1 | 1 (mandatory) | 1 |
| 3 | 2 | 1 (mandatory) | 2 |
| 2 | 3 | 1 (mandatory) | 3 |
| 1 | 4 | 1 (mandatory) | 4 |

The mandatory minimum of 1 is preserved regardless of mode. The feature only adds extra capacity when `nonRankerCount < 5`.

---

## Gameplay Flow

1. Card submission phase begins as normal — each guesser sees a text field
2. Guesser submits a card → it appears in a "your submissions" list below the field
3. Guesser can keep submitting more cards as long as the pool isn't full
4. When satisfied, guesser presses **Done** — they are locked out of submitting more
5. Once all guessers press Done (or the pool fills up), remaining slots are auto-filled and phase advances to ranking

---

## Setting

Add `multipleSubmissionsEnabled: boolean` to `GameSettings`.

**`shared/src/types.ts`**
```typescript
export interface GameSettings {
  promptsEnabled: boolean;
  roundCount: number;
  multipleSubmissionsEnabled: boolean;
}
```

**`client/src/screens/Home.tsx`**
Update `defaultSettings` to include `multipleSubmissionsEnabled: false`.

**`client/src/screens/Lobby.tsx`**
Add a toggle in the settings section (host can change, non-host sees read-only state):
```
[ ] Allow multiple card submissions
```

---

## Server Changes

### `shared/src/types.ts`
- Add `multipleSubmissionsEnabled: boolean` to `GameSettings`
- Add `cardPool: number` to `LobbyState` — the number of remaining open slots, so the client can show "X slots remaining"
- Add `playerCardCounts: Record<string, number>` to `LobbyState` — how many cards each guesser has submitted so far, so the ranker's progress view can show a count rather than just ✓/✗

### `server/src/lobby.ts`
- Add `playerCardCounts: Map<string, number>` to `ServerGameState` — initialised to `{}` in `startTurn`
- Update `toLobbyState` to include:
  - `cardPool`: `Math.max(0, 5 - nonRankerCount - state.cards.length)` — remaining open slots
  - `playerCardCounts`: `Object.fromEntries(state.playerCardCounts)`

### `server/src/handlers/gameHandlers.ts`

**`submit-card` handler** — current logic submits one card and marks the player as done. New logic:

```typescript
socket.on('submit-card', ({ text }) => {
  if (state.phase !== 'card_submission') return;
  if (socket.id === state.currentRankerId) return;
  if (state.submittedPlayerIds.has(socket.id)) return; // already pressed Done

  // Always allow at least one submission
  // In multi-submission mode: allow more if pool isn't full
  const nonRankerCount = state.players.size - 1;
  const poolSize = Math.max(0, 5 - nonRankerCount);
  const extraCardsSubmitted = state.cards.filter(c => c.authorId !== null).length - nonRankerCount;

  if (state.settings.multipleSubmissionsEnabled) {
    if (state.cards.length >= 5) return; // pool full
  } else {
    // Original behaviour: one card per player
    const alreadySubmitted = state.cards.some(c => c.authorId === socket.id);
    if (alreadySubmitted) return;
  }

  state.cards.push(createPlayerCard(text, socket.id));
  state.playerCardCounts.set(socket.id, (state.playerCardCounts.get(socket.id) || 0) + 1);

  // In single-submission mode: mark done immediately after first card
  if (!state.settings.multipleSubmissionsEnabled) {
    state.submittedPlayerIds.add(socket.id);
  }

  io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  checkPhaseAdvance(io, state);
});
```

**New `done-submitting` handler** — only relevant in multi-submission mode:

```typescript
socket.on('done-submitting', () => {
  if (state.phase !== 'card_submission') return;
  if (socket.id === state.currentRankerId) return;
  if (!state.settings.multipleSubmissionsEnabled) return;

  // Must have submitted at least one card before pressing Done
  if (!state.playerCardCounts.has(socket.id) || state.playerCardCounts.get(socket.id)! < 1) return;

  state.submittedPlayerIds.add(socket.id);
  io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  checkPhaseAdvance(io, state);
});
```

**`checkPhaseAdvance`** — no change needed. It already advances when `submittedPlayerIds.size >= nonRankerCount`, which now means "all guessers have pressed Done" rather than "all guessers have submitted one card".

**`handleAutoSubmit`** — extend to cover multi-submission mode: if the player hasn't pressed Done yet, auto-submit a `"..."` card for them (if they haven't submitted any) and mark them done.

### `shared/src/types.ts` — ClientEvents
Add:
```typescript
'done-submitting': () => void;
```

---

## Client Changes

### `client/src/screens/CardSubmission.tsx`

The guesser view needs to change significantly when `multipleSubmissionsEnabled` is true:

**Single-submission mode (unchanged):** One text field, Submit button, then waiting screen.

**Multi-submission mode:**
- Text field + **Submit Card** button (adds to pool, field clears)
- Below the field: list of cards the player has submitted so far ("Your submissions: 2 cards")
- Counter: "X slots remaining in the pool" (from `lobbyState.cardPool`)
- Submit Card button disabled when pool is full (`cardPool === 0`)
- **Done** button — always visible once at least 1 card submitted, disabled until then
- After pressing Done: show waiting screen as now

**Ranker view** — update the player list to show card counts instead of just ✓/✗:
- Not done: "2 cards · still submitting"
- Done: "3 cards · done ✓"

Use `lobbyState.playerCardCounts[player.id]` for the counts.

---

## Lobby Settings UI

**`client/src/screens/Lobby.tsx`** — in the settings section, add below the rounds slider:

Host view:
```
[toggle] Allow multiple card submissions
         Guessers can submit more than one card to fill the pool
```

Non-host view:
```
Multiple submissions: On / Off
```

---

## Todo

- [ ] Add `multipleSubmissionsEnabled` to `GameSettings` in `shared/src/types.ts`
- [ ] Add `cardPool` and `playerCardCounts` to `LobbyState` in `shared/src/types.ts`
- [ ] Add `done-submitting` to `ClientEvents` in `shared/src/types.ts`
- [ ] Add `playerCardCounts` to `ServerGameState` in `server/src/lobby.ts`
- [ ] Update `toLobbyState` to include `cardPool` and `playerCardCounts`
- [ ] Update `startTurn` to reset `playerCardCounts`
- [ ] Update `submit-card` handler in `gameHandlers.ts` for multi-submission mode
- [ ] Add `done-submitting` handler in `gameHandlers.ts`
- [ ] Update `handleAutoSubmit` to handle multi-submission disconnects
- [ ] Update `defaultSettings` in `Home.tsx`
- [ ] Add toggle to Lobby settings (host + read-only non-host)
- [ ] Update `CardSubmission.tsx` guesser view for multi-submission mode
- [ ] Update `CardSubmission.tsx` ranker view to show per-player card counts
