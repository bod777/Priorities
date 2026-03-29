# Reconnection Plan

## Overview

This document describes how to implement robust disconnect/reconnect handling for Priorities. The goal is to keep the game moving even when players drop, and to let players rejoin seamlessly without losing their place.

---

## 1. Reconnection Tokens

### Problem
Socket.IO assigns a new socket ID on every connection. When a player refreshes or loses connection, the server has no way to link the new socket to the old player slot, so the player is treated as a brand-new user.

### Approach
Issue each player a persistent **reconnection token** (a short random UUID) when they join or create a lobby. The client stores it in `localStorage` keyed by lobby code. On the next connection, the client checks localStorage and emits a `reconnect-player` event before doing anything else.

### Server changes

**`shared/src/types.ts`**
- Add `ClientEvents['reconnect-player']`: `(data: { token: string; lobbyCode: string }) => void`
- Add `ServerEvents['reconnect-failed']`: `(data: { message: string }) => void`
- Add `ServerEvents['reconnect-success']`: `(data: LobbyState & { token: string }) => void` — sends full game state so the client can recover any screen

**`server/src/lobby.ts`**
- Add `reconnectTokens: Map<string, string>` to `ServerGameState` — maps `token → socketId` (old)
- Add a separate top-level `Map<string, string>`: `tokenToLobby` — maps `token → lobbyCode` (survives socket drops)
- In `createLobby` and `joinLobby`: generate a token (`crypto.randomUUID()`), store `reconnectTokens.set(token, socketId)` and `tokenToLobby.set(token, lobbyCode)`, return token alongside state
- Add `reconnectPlayer(token, newSocketId)` function:
  1. Look up `lobbyCode` from `tokenToLobby`
  2. Look up lobby from `lobbies`
  3. Find the player whose old socket ID matches `reconnectTokens.get(token)`
  4. Swap: update `players` map key, `socketToLobby`, `submittedPlayerIds`, `scores`, `rankerOrder`, `rankerStats`, `hostId`, `currentRankerId` — anywhere the old socket ID appears
  5. Update `reconnectTokens.set(token, newSocketId)` to point to new socket
  6. Mark `player.connected = true`
  7. Cancel any pending auto-submit/advance timers for this player (see section 4)
  8. Return full state

**`server/src/handlers/lobbyHandlers.ts`**
- Add `socket.on('reconnect-player', ...)` handler:
  1. Call `reconnectPlayer(token, socket.id)`
  2. On failure: emit `reconnect-failed`
  3. On success: `socket.join(state.lobbyCode)`, emit `reconnect-success` with full state + fresh token, broadcast `lobby-updated` to room so others see them as reconnected

### Client changes

**`client/src/hooks/useSocket.ts`**
- On `connect` event (which fires on every reconnect): check `localStorage` for a stored token + lobby code
- If found, emit `reconnect-player` before anything else
- Socket.IO's built-in `reconnection: true` (already configured) handles the TCP-level retry — this layer handles the game-level identity restoration

**`client/src/context/GameContext.tsx`**
- Add handler for `reconnect-success`: dispatch `SET_LOBBY` with the returned state and store the new token in localStorage
- Add handler for `reconnect-failed`: clear localStorage token, stay on Home screen
- Clear the stored token from localStorage when:
  - `reset-game` is emitted (play again)
  - Player navigates to Home intentionally

**`client/src/screens/Home.tsx`**
- On mount, check localStorage for a token — if found, show a "Rejoin game" button instead of/alongside the normal join form, which triggers the reconnect flow

### Token storage in localStorage
```
priorities_reconnect_token   →  "abc-123-..."
priorities_reconnect_lobby   →  "XKQP"
```
Both are cleared together when the game ends or the player explicitly leaves.

---

## 2. Fix: Ranker Disconnects During `ranking` Phase

### Problem
The ranker is the only one who can submit a ranking. If they disconnect, `state.rankerRanking` stays null, `advancePhase` is never called, and the game is permanently stuck.

### Approach
When the auto-submit timer fires for a disconnected ranker who is in the `ranking` phase, auto-generate a random ranking from the current cards and advance the phase.

### Server changes

**`server/src/handlers/gameHandlers.ts`** — extend `handleAutoSubmit`:

```typescript
function handleAutoSubmit(io, state, playerId) {
  // Existing: guesser auto-submit during card_submission
  if (state.phase === 'card_submission' && playerId !== state.currentRankerId) {
    state.cards.push(createPlayerCard('...', playerId));
    state.submittedPlayerIds.add(playerId);
    checkPhaseAdvance(io, state);
    return;
  }

  // New: ranker auto-submit during ranking phase
  if (state.phase === 'ranking' && playerId === state.currentRankerId) {
    const shuffled = [...state.cards.map(c => c.id)].sort(() => Math.random() - 0.5);
    state.rankerRanking = shuffled;
    advancePhase(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    return;
  }

  // New: guesser auto-lock during guessing phase
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
  }
}
```

---

## 3. Fix: Guesser Disconnects During `guessing` Phase

### Problem
If a guesser disconnects without locking, the game waits forever for them. The current timer only handles `card_submission`. As shown above, the fix is to extend `handleAutoSubmit` to also auto-lock disconnected guessers during the `guessing` phase.

### Edge case: disconnected guesser had already locked
No action needed — they're already in `submittedPlayerIds`. The lock count is correct and the game will advance normally when the remaining players lock.

### Edge case: all non-disconnected players lock, but disconnected player pushes count to 100%
This is handled correctly by the auto-lock in `handleAutoSubmit` — when the timer fires it will auto-lock them and trigger `emitRevealResults` if they were the last needed.

---

## 4. Timer Management (Cancellation on Reconnect)

### Problem
Currently, the auto-submit timer is a bare `setTimeout` with no way to cancel it. If a player reconnects before the timer fires, the timer will still fire and auto-submit on their behalf — potentially submitting a card or auto-locking them even though they're back.

### Approach
Track pending timers per player in a server-side map:

**`server/src/lobby.ts`**
- Add `pendingAutoSubmitTimers: Map<string, ReturnType<typeof setTimeout>>` to `ServerGameState`

**`server/src/handlers/gameHandlers.ts`**
- When setting the timer on disconnect: `state.pendingAutoSubmitTimers.set(socket.id, setTimeout(...))`
- In `reconnectPlayer` (lobby.ts): `clearTimeout(state.pendingAutoSubmitTimers.get(oldSocketId))` and delete from map
- When auto-submit fires: delete from map after running

---

## 5. Reduce Auto-Submit Timer

### Current behavior
The timer is hardcoded to 30 seconds (`gameHandlers.ts:241`).

### Change
Increase to **60 seconds** — gives more time to reconnect, especially on mobile. This is a simple constant change:

```typescript
// gameHandlers.ts
const AUTO_SUBMIT_DELAY_MS = 60_000;

// in disconnect handler:
setTimeout(() => { ... }, AUTO_SUBMIT_DELAY_MS);
```

---

## 6. Host Disconnects

### Current behavior
If the host disconnects during an active game, host promotion happens immediately on disconnect (only if in `lobby` phase — `gameHandlers.ts:218`). During an active game phase the host is just marked `connected: false` and there's no promotion.

### Problem
The host is the only one who can emit `next-turn` (to advance from reveal) and `reset-game`. If the host disconnects during `reveal`, the game is stuck waiting for "Next Turn."

### Approach
- On disconnect during an active game phase: start a timer (same 60s delay)
- If host hasn't reconnected when the timer fires: promote the next connected player as host, broadcast `lobby-updated`
- This can be added to the auto-submit timer callback — check if the disconnected player was host, and if so promote a new one before running auto-submit logic

---

## 7. UI: Disconnection Indicators

### Current behavior
The `Player` type has a `connected` boolean (`shared/src/types.ts:18`) but the UI doesn't use it anywhere.

### Suggested additions
- In `Lobby.tsx` player list: grey out disconnected players, show "disconnected" badge
- In `CollectiveGuess.tsx` locked count: show `(1 disconnected)` note if any non-ranker is disconnected, so players know why it's delayed
- In `Ranking.tsx` (ranker's screen): show a note if players have disconnected
- On reconnect: show a brief "You've rejoined the game" toast

These are polish items and can be done after the core logic is in place.

---

## Implementation Order

1. **Timer management + cancellation map** (prerequisite for everything else — low risk, small change)
2. **Raise timer to 60s**
3. **Extend `handleAutoSubmit` to cover `ranking` and `guessing` phases** (fixes stuck game, no client changes needed)
4. **Host promotion during active game on disconnect timer**
5. **Reconnection tokens** (largest change, touches shared types, server lobby, client context and hooks)
6. **UI disconnection indicators** (polish)
