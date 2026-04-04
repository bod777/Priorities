# Routing Plan

## Goal

Add URL-based routing so the lobby code lives in the URL (`/ABCD`). This means:

- On page reload, the lobby code is still in the URL
- The client auto-joins / reconnects to the correct lobby without needing localStorage tokens
- The URL is shareable — someone opening `/ABCD` sees a join form pre-filled with that code
- Development is much easier: reload the page, you're back in the game

---

## Routes

| Path | Behaviour |
|---|---|
| `/` | Home screen — create or join |
| `/:code` | Lobby/game screen — if already a member, reconnect; if not, show join form |

No other routes needed. All game phases (lobby, card submission, ranking, etc.) stay at `/:code` — the `GameRouter` handles which screen to show based on `lobbyState.phase`.

---

## Library

Add `react-router-dom` to the client:

```
npm install react-router-dom
```

Use `createBrowserRouter` + `RouterProvider` (React Router v6).

---

## Server: expose lobby state to unauthenticated clients

Currently there is no way to ask the server "does lobby ABCD exist and can I join it?" without emitting a socket event that assumes you're already in a lobby. We need one new event:

**`ClientEvents`**: `'get-lobby-info': (data: { code: string }) => void`

**`ServerEvents`**: `'lobby-info': (data: { exists: boolean; phase: GamePhase; playerCount: number; canJoin: boolean }) => void`

This lets the `/:code` page ask "is this lobby joinable?" before showing a join form. `canJoin` is true when `phase === 'lobby'` and `playerCount < 6`.

Alternatively, skip this and just let the join attempt fail with the existing `error` event — simpler, handle the error in the UI. **Go with this simpler approach.**

---

## Reconnect vs. fresh join at `/:code`

When a user lands on `/:code`, there are three cases:

1. **They have a reconnect token for this lobby** (stored in localStorage keyed by lobby code) → auto-fire `reconnect-player`, skip the join form entirely, show "Rejoining..." spinner
2. **They have no token** (fresh visit or different device) → show a join form pre-filled with the code, just needs display name
3. **Reconnect fails** (server restarted, lobby gone) → clear the token, fall back to case 2

### localStorage key change

Currently reconnect tokens are stored as two flat keys: `priorities_reconnect_token` and `priorities_reconnect_lobby`. This only supports one active lobby at a time. Change to a single key per lobby code:

```
priorities_token_{CODE}  →  { token: string }
```

This is cleaner and supports the URL-driven approach — when you land on `/ABCD`, look up `priorities_token_ABCD`.

---

## Component structure

```
main.tsx
  └─ RouterProvider
       └─ App (ErrorBoundary + GameProvider + ConnectionStatus + ToastContainer)
            ├─ Route /        → <Home />
            └─ Route /:code   → <LobbyPage />
```

`<LobbyPage />` is a new thin component that:
- Reads `:code` from the URL params
- On mount: checks localStorage for a token for this code
  - If found: emits `reconnect-player`, shows spinner
  - If not: shows a join form (display name input + Join button)
- Once `lobbyState` is set in GameContext: renders `<GameRouter />`

`<GameRouter />` stays exactly as-is — it reads `lobbyState.phase` and renders the right screen.

`<Home />` simplifies — no more reconnect banner, just create/join.

---

## Navigation

- **After create-lobby succeeds** → `navigate(`/${lobbyCode}`)`
- **After join-lobby succeeds** → `navigate(`/${lobbyCode}`)` (already at `/:code`, but navigation confirms it)
- **After game-over + play again (reset-game)** → stay at `/:code`, no navigation needed
- **Leave lobby / go home** → `navigate('/')` + clear token for that code

---

## Server: lobby lifetime

No changes needed to lobby lifetime for this feature. The lobby already survives player disconnects (with grace period). The URL just makes it easy to get back to the right page.

If the server restarts, the lobby is gone and the join form is shown — user re-enters their name and creates/joins a new one. This is acceptable.

---

## Files to Create / Modify

| File | Change |
|---|---|
| `client/package.json` | Add `react-router-dom` dependency |
| `client/src/main.tsx` | Wrap app in `RouterProvider` with two routes |
| `client/src/App.tsx` | Remove `<Home />` and `<GameRouter />` from App — these move to route components. App becomes just the providers + global overlays |
| `client/src/pages/LobbyPage.tsx` | New — handles `/:code` route, reconnect vs join logic, renders `<GameRouter />` once in a lobby |
| `client/src/screens/Home.tsx` | Simplify — remove reconnect banner, add `navigate` after create/join |
| `client/src/context/GameContext.tsx` | Navigate to `/:code` after `lobby-created` / `lobby-joined` / `reconnect-success`. Navigate to `/` after `reconnect-failed` |
| `client/src/hooks/useSocket.ts` | Update `saveReconnectInfo` / `clearReconnectInfo` to use per-lobby key `priorities_token_{CODE}` |
| `shared/src/types.ts` | No changes needed |
| `server/src/handlers/lobbyHandlers.ts` | No changes needed |

---

## Vite config — SPA fallback

For development, Vite already handles this. For production (Railway), Express needs to serve `index.html` for all non-asset routes. Add a catch-all to the server:

**`server/src/index.ts`**
```typescript
// After all API/socket setup, before listen:
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});
```

This is likely already in place or needs to replace the current static middleware setup.

---

## Todo

- [ ] Install `react-router-dom` in the client (`npm install react-router-dom` in `client/`)
- [ ] Update `saveReconnectInfo` / `clearReconnectInfo` in `useSocket.ts` to use per-lobby key `priorities_token_{CODE}`
- [ ] Update `GameContext.tsx` to call `navigate` after `lobby-created`, `lobby-joined`, `reconnect-success`, and `reconnect-failed` (requires passing a navigate function or using `useNavigate` inside the provider)
- [ ] Create `client/src/pages/LobbyPage.tsx` — reads `:code` from URL, checks for token, shows spinner or join form, renders `<GameRouter />` once in lobby
- [ ] Update `client/src/App.tsx` — remove `<Home />` / `<GameRouter />` routing logic, keep only providers + global overlays
- [ ] Update `client/src/main.tsx` — wrap with `RouterProvider`, define two routes (`/` → `<Home />`, `/:code` → `<LobbyPage />`)
- [ ] Simplify `client/src/screens/Home.tsx` — remove reconnect banner, add `navigate(`/${lobbyCode}`)` after create/join
- [ ] Add SPA catch-all route to `server/src/index.ts` so Railway serves `index.html` for all paths
- [ ] Test: create lobby → URL updates to `/ABCD` → reload → back in game without re-entering name
- [ ] Test: share `/ABCD` URL in a fresh tab → join form shown pre-filled with code
- [ ] Test: server restart → land on `/ABCD` → join form shown (token cleared), can re-join with name
