# Lobby List / Player Sidebar Plan

## Overview

Two separate features:

1. **Player sidebar** — a slide-in panel on the right side of the screen, accessible from any game screen, showing who's in the game, scores, and settings
2. **Disconnect alert** — a toast notification that appears whenever any player disconnects during a game

---

## Feature 1: Player Sidebar

### Trigger / Toggle

A persistent tab on the right edge of the screen — always visible regardless of which screen the user is on (except the Home screen where there's no game in progress). It shows the user's own display name as a short label. Clicking it opens/closes the sidebar.

**Tab appearance:**
```
┌────────────┐
│  BRIAN  ›  │  ← vertical text or horizontal, right-anchored
└────────────┘
```

The tab is fixed-position, sits on top of all other content, and does not interfere with the main game layout.

### Sidebar content

When open, the sidebar slides in from the right (Tailwind `translate-x` transition). It has three sections:

**1. Players**
- List all players in `lobbyState.players`
- Each row shows:
  - Display name (bold if it's you)
  - "You" badge next to your own name
  - Crown icon for the host
  - Disconnected indicator (grey + "disconnected") if `player.connected === false`
  - Current score (from `lobbyState` — need to expose this, see below)

**2. Scores**
- Only visible once the game has started (phase is not `lobby`)
- Sorted descending by score
- Shows each player's cumulative score
- Scores are already in `TurnResult.totalScores` after each reveal, but during a turn they're not available on the client
- Solution: add `scores: Record<string, number>` to `LobbyState` so scores are always available

**3. Game Settings**
- Rounds: X (Y turns)
- Multiple submissions: On / Off

### Where it lives in the component tree

`App.tsx` renders `<ConnectionStatus />` and `<GameRouter />` inside `<GameProvider>`. The sidebar should be rendered at the same level as `<ConnectionStatus />` — always mounted, always on top, reads from `GameContext`.

Add a new component `<PlayerSidebar />` and render it in `App.tsx`:

```tsx
export function App() {
  return (
    <ErrorBoundary>
      <GameProvider>
        <ConnectionStatus />
        <PlayerSidebar />   {/* new */}
        <GameRouter />
      </GameProvider>
    </ErrorBoundary>
  );
}
```

`<PlayerSidebar />` reads `lobbyState` and `playerId` from `useGame()`. If `lobbyState` is null (Home screen), it renders nothing.

### State

The sidebar needs one piece of local state: `isOpen: boolean`. No global state needed — it's purely UI.

### Scores in LobbyState

Currently `scores` lives only on `ServerGameState` and is exposed to the client only through `TurnResult.totalScores` after each reveal. To show scores in the sidebar at all times, add `scores` to `LobbyState` and populate it in `toLobbyState`:

**`shared/src/types.ts`**
```typescript
interface LobbyState {
  // ... existing fields
  scores: Record<string, number>;
}
```

**`server/src/lobby.ts` — `toLobbyState`**
```typescript
scores: Object.fromEntries(state.scores),
```

---

## Feature 2: Disconnect Alert Toast

### Behaviour

When any player's `connected` status changes from `true` to `false`, show a toast notification:

```
⚠️  BRIAN disconnected
```

The toast appears at the top of the screen (below the connection status bar), auto-dismisses after 4 seconds, and can be manually dismissed. If multiple players disconnect in quick succession, each gets its own toast (stacked).

### Implementation

**Detecting disconnects:**

In `GameContext.tsx`, the `handleLobbyUpdated` handler already receives the full new `LobbyState`. Compare incoming players against the previous state's players to detect newly-disconnected players:

```typescript
const handleLobbyUpdated = (data: LobbyState) => {
  const prev = stateRef.current.lobbyState;
  if (prev) {
    for (const player of data.players) {
      const prevPlayer = prev.players.find(p => p.id === player.id);
      if (prevPlayer?.connected && !player.connected) {
        // this player just disconnected — dispatch a toast
        dispatch({ type: 'ADD_TOAST', message: `${player.displayName} disconnected` });
      }
    }
  }
  // ... rest of handler
};
```

**Toast state in GameContext:**

Add toasts to the reducer:

```typescript
type GameAction =
  | ...existing actions
  | { type: 'ADD_TOAST'; message: string; id: string }
  | { type: 'REMOVE_TOAST'; id: string }

interface GameContextState {
  // ... existing fields
  toasts: { id: string; message: string }[];
}
```

**`<ToastContainer />` component:**

New component, rendered in `App.tsx` alongside `<PlayerSidebar />`. It reads `toasts` from `useGame()` and renders them as fixed-position overlays. Each toast auto-removes itself after 4 seconds using `useEffect` + `setTimeout` that dispatches `REMOVE_TOAST`.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `client/src/components/PlayerSidebar.tsx` | New component |
| `client/src/components/ToastContainer.tsx` | New component |
| `client/src/App.tsx` | Add `<PlayerSidebar />` and `<ToastContainer />` |
| `client/src/context/GameContext.tsx` | Add toast state/actions, detect disconnects in handleLobbyUpdated |
| `shared/src/types.ts` | Add `scores` to `LobbyState` |
| `server/src/lobby.ts` | Populate `scores` in `toLobbyState` |

---

## Todo

- [ ] Add `scores: Record<string, number>` to `LobbyState` in `shared/src/types.ts`
- [ ] Populate `scores` in `toLobbyState` in `server/src/lobby.ts`
- [ ] Add `toasts` array and `ADD_TOAST` / `REMOVE_TOAST` actions to `GameContext.tsx`
- [ ] Detect disconnects in `handleLobbyUpdated` and dispatch `ADD_TOAST`
- [ ] Create `client/src/components/ToastContainer.tsx`
- [ ] Create `client/src/components/PlayerSidebar.tsx`
  - [ ] Fixed tab on right edge showing own display name
  - [ ] Slide-in panel with players list (you / host / disconnected badges + scores)
  - [ ] Scores section (sorted, only shown once game has started)
  - [ ] Settings section (rounds, multiple submissions)
- [ ] Add `<PlayerSidebar />` and `<ToastContainer />` to `App.tsx`
- [ ] Hide sidebar on Home screen (no `lobbyState`)
