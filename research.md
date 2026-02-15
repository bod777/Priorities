# Technical Research: Building the Ranking Game Web App

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Real-Time Communication](#2-real-time-communication)
3. [Backend Design](#3-backend-design)
4. [Frontend Design](#4-frontend-design)
5. [Data Flow Per Phase](#5-data-flow-per-phase)
6. [Scoring Engine](#6-scoring-engine)
7. [Security & Cheating Prevention](#7-security--cheating-prevention)
8. [Deployment & Hosting](#8-deployment--hosting)
9. [Project Structure](#9-project-structure)
10. [Reveal Screen UX](#10-reveal-screen-ux-the-most-important-screen)
11. [Collective Mode: Shared Board Design](#11-collective-mode-shared-board-design)
12. [Auto-Generated Card Strategy](#12-auto-generated-card-strategy)
13. [Key Technical Risks & Mitigations](#13-key-technical-risks--mitigations)
14. [Implementation Priority (Build Order)](#14-implementation-priority-build-order)

---

## 1. System Architecture Overview

This is a **real-time, session-based multiplayer game** with no persistent user accounts. The core architectural challenge is synchronizing game state across 3-6 players through a series of timed phases where different players have different views of the data (the ranker sees things others don't, and vice versa).

### High-Level Architecture

```
┌──────────────┐     WebSocket      ┌──────────────────┐     ┌─────────────┐
│   Browser     │◄──────────────────►│   Game Server     │◄───►│  Data Store  │
│  (React SPA)  │                    │  (Node + WS)      │     │  (Redis)     │
└──────────────┘                    ├──────────────────┤     └─────────────┘
                                     │  REST API (HTTP)  │
                                     │  - Create lobby   │
                                     │  - Join lobby     │
                                     └──────────────────┘
```

- **Frontend**: Single-page app. Every player loads the same app; the UI adapts based on their role (host, ranker, guesser) and the current game phase.
- **Backend**: A stateful game server managing lobbies, game phases, and broadcasting state changes via WebSockets.
- **Data Store**: In-memory or Redis for ephemeral game sessions (no long-term persistence needed since games are throwaway sessions).

---

## 2. Real-Time Communication

### Why WebSockets (Not Polling or SSE)

This game requires **bidirectional, low-latency communication**:
- Server pushes phase transitions, card reveals, score updates to all clients.
- Clients push submissions (cards, rankings, guesses) to the server.
- Multiple players are interacting concurrently within the same session.

HTTP polling would be wasteful and laggy. Server-Sent Events (SSE) are unidirectional. **WebSockets are the right fit.**

### Technology Choice: Socket.IO

**Socket.IO** (on top of Node.js) is the pragmatic choice:
- Built-in **rooms** — each lobby is a room. Broadcasting to a lobby is one line of code.
- Automatic reconnection handling (critical for mobile browsers that background tabs).
- Falls back to HTTP long-polling if WebSocket connection fails.
- Mature ecosystem with extensive documentation.
- Supports **namespaces** for separating concerns (e.g., `/lobby`, `/game`).

### Alternative: Raw WebSocket via `ws` library
- Lighter weight, no abstraction overhead.
- But you'd have to manually implement rooms, reconnection, and fallback — not worth it for this use case.

### Communication Model

```
Client → Server (emit):
  - "create-lobby" { displayName, settings }
  - "join-lobby" { code, displayName }
  - "submit-card" { text }
  - "submit-ranking" { ranking: [cardId, cardId, ...] }
  - "submit-guess" { ranking: [cardId, cardId, ...] }
  - "submit-authorship-guess" { guesses: { cardId: playerId | "auto" } }
  - "submit-personal-ranking" { ranking: [cardId, cardId, ...] }
  - "start-game" (host only)
  - "advance-phase" (host/server triggered)

Server → Client (emit):
  - "lobby-updated" { players, settings, hostId }
  - "phase-changed" { phase, roundNumber, rankerId, cards?, timer? }
  - "player-submitted" { playerId } (tells others someone has submitted, no content)
  - "reveal-ranking" { trueRanking, guesses, scores }
  - "reveal-authorship" { authorshipGuesses, trueAuthorship, bonusPoints }
  - "reveal-personal-rankings" { allPersonalRankings }
  - "game-over" { finalScores, superlatives }
  - "error" { message }
```

### Key Principle: Server is the Source of Truth

The server holds all game state. Clients are dumb renderers. The server:
- Validates every submission (correct phase, correct player role, correct format).
- Controls phase transitions (only advances when all required submissions are in).
- Never sends data a player shouldn't see (e.g., the ranker's ranking is not sent to guessers until reveal).

---

## 3. Backend Design

### Tech Stack
- **Runtime**: Node.js
- **Framework**: Express (for the REST endpoints: create lobby, join lobby, health check)
- **WebSocket**: Socket.IO
- **Data Store**: In-memory (Map/Object) for simplicity; Redis if scaling to multiple server instances is needed later.
- **Language**: TypeScript — the game state is complex with many phases and roles; type safety prevents a whole class of bugs.

### Game State Machine

The game is a **finite state machine**. Each round progresses through phases linearly, and the server enforces valid transitions.

```
LOBBY → CARD_SUBMISSION → AUTO_FILL → RANKER_VIEW → [AUTHORSHIP_GUESS → AUTHORSHIP_REVEAL] → RANKING → GUESSING → [PERSONAL_RANKING] → REVEAL → (next round or GAME_OVER)
```

Phases in brackets are optional based on lobby settings.

#### State Object Structure (per lobby)

```typescript
interface GameState {
  lobbyCode: string;
  hostId: string;
  settings: {
    guessingMode: "collective" | "individual";
    authorshipGuess: boolean;
    personalRanking: boolean;
    promptsEnabled: boolean;
    roundCount: number;
  };
  players: Map<string, Player>;       // socketId -> Player
  phase: GamePhase;
  currentRound: number;
  rankerOrder: string[];               // player IDs in rotation order
  currentRankerId: string;
  cards: Card[];                       // the 5 cards for this round
  rankerRanking: string[] | null;      // card IDs ordered 1-5
  guesses: Map<string, string[]>;      // playerId -> their guessed ranking (individual mode)
  collectiveGuess: string[] | null;    // the shared guess (collective mode)
  authorshipGuesses: Map<string, string> | null;  // cardId -> guessed playerId
  personalRankings: Map<string, string[]>;         // playerId -> their personal ranking
  scores: Map<string, number>;         // playerId -> cumulative score
  rankerStats: Map<string, number[]>;  // rankerId -> array of scores against them
  roundHistory: RoundResult[];
}

interface Player {
  id: string;
  displayName: string;
  isHost: boolean;
  connected: boolean;
}

interface Card {
  id: string;
  text: string;
  authorId: string | null;   // null = auto-generated
  isAutoGenerated: boolean;
}

type GamePhase =
  | "lobby"
  | "card_submission"
  | "ranker_view"
  | "authorship_guess"
  | "authorship_reveal"
  | "ranking"
  | "guessing"
  | "personal_ranking"
  | "reveal"
  | "game_over";
```

### Phase Transition Logic

The server tracks who has submitted in each phase and auto-advances when all expected submissions are in:

| Phase | Who Submits | Advance When |
|-------|-------------|--------------|
| `card_submission` | All non-rankers | All `N-1` players have submitted a card |
| `authorship_guess` | Ranker only | Ranker submits guesses |
| `ranking` | Ranker only | Ranker submits their ranking |
| `guessing` | Non-rankers | All guessers submitted (individual) or one group submission received (collective) |
| `personal_ranking` | Non-rankers (+ optionally ranker) | All participating players submitted |

### Lobby Code Generation

- 4-character alphanumeric code, uppercase (e.g., `AXBT`).
- Exclude ambiguous characters: `0`, `O`, `I`, `L`, `1`.
- Character set: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (26 chars).
- 26^4 = 456,976 possible codes — more than enough for concurrent sessions.
- On creation, check that the code isn't already in use (collision check against active lobbies).

### Auto-Generated Cards

When the game needs to fill slots to reach 5 cards, it generates contextually appropriate strings.

**Approach options:**
1. **Pre-built card pool**: A curated list of hundreds of generic fun cards, randomly sampled. Simple, no external dependency. Works well for free-form mode.
2. **LLM-generated**: Call an AI API (e.g., Claude) to generate cards that blend with the player submissions. Higher quality, but adds latency and cost.
3. **Hybrid**: Use a pre-built pool by default; use LLM generation only when prompts are enabled (since the cards need to match the prompt topic).

**Recommendation**: Start with a pre-built card pool for v1. It's fast, free, and deterministic. The pool should be large enough (~500+ cards) and categorized loosely so cards feel varied.

For free-form mode, the auto-generated cards just need to be plausible things someone might write — funny phrases, random opinions, pop culture references, food items, activities, etc.

### Disconnection & Reconnection

- When a player disconnects, their `connected` flag is set to `false`.
- The game continues — other players see a "disconnected" indicator.
- A short grace period (e.g., 30 seconds) allows reconnection before the player is treated as absent.
- On reconnect (same socket joins with same display name + lobby code), restore their state.
- If a disconnected player needs to submit and doesn't reconnect in time, auto-submit a default (e.g., skip their card, use a random ranking).
- If the **host** disconnects, host privileges transfer to the next player.

---

## 4. Frontend Design

### Tech Stack
- **Framework**: React (with hooks and functional components)
- **State Management**: React Context + `useReducer` for game state. The state is ephemeral (one session) and moderate in complexity — no need for Redux or Zustand.
- **Styling**: Tailwind CSS — utility-first, fast to iterate on, good for responsive design (players will be on phones).
- **Drag-and-Drop**: `@dnd-kit/core` — for the ranking UI where players drag cards into position. Lightweight, accessible, works on mobile touch.
- **Build Tool**: Vite — fast dev server, simple config, good React support.
- **Deployment**: Static files served alongside the backend, or on a CDN.

### Screen / View Map

The app is a single page that renders different views based on the game phase and the player's role.

```
1. HOME SCREEN
   └── Enter display name
   └── "Create Lobby" or "Join Lobby (enter code)"

2. LOBBY SCREEN (waiting room)
   └── Player list (who's joined)
   └── Settings panel (host only): guessing mode, toggles, round count
   └── Join code displayed prominently (for sharing)
   └── "Start Game" button (host only, enabled when 3+ players)

3. CARD SUBMISSION SCREEN
   ├── [Ranker view]: "Waiting for players to submit cards..."
   └── [Guesser view]: Text input for card + optional generated suggestions
       └── "Submit" button
       └── Status: "2/4 players have submitted"

4. AUTHORSHIP GUESS SCREEN (optional)
   ├── [Ranker view]: 5 cards displayed, assign each to a player or "auto-generated"
   └── [Guesser view]: "Waiting for ranker..."

5. AUTHORSHIP REVEAL SCREEN (optional)
   └── Shows ranker's guesses vs. reality, animated reveal

6. RANKING SCREEN
   ├── [Ranker view]: 5 cards, drag to rank 1-5
   └── [Guesser view]: "Waiting for ranker to rank..."

7. GUESSING SCREEN
   ├── [Ranker view]: "Waiting for guessers..."
   └── [Guesser view]:
       ├── [Collective mode]: Shared drag-to-rank UI, everyone sees changes live
       └── [Individual mode]: Personal drag-to-rank UI

8. PERSONAL RANKING SCREEN (optional)
   └── All non-rankers (and optionally ranker): drag-to-rank by personal preference

9. REVEAL SCREEN
   └── Animated reveal of true ranking vs. guesses
   └── Score breakdown for this round
   └── Authorship results (if enabled)
   └── Personal ranking comparison matrix (if enabled)
   └── "Next Round" button (host) or auto-advance with timer

10. GAME OVER SCREEN
    └── Final leaderboard
    └── Superlatives (most predictable ranker, least predictable, best guesser)
    └── Round-by-round history
    └── "Play Again" / "Back to Lobby" options
```

### UI Component Breakdown

#### Core Components

| Component | Description |
|-----------|-------------|
| `App` | Root. Manages socket connection and top-level routing by game phase. |
| `HomeScreen` | Name input, create/join lobby buttons, code input field. |
| `LobbyScreen` | Player list, settings (host), join code display, start button. |
| `PhaseScreen` | Wrapper that renders the correct sub-screen based on `phase` + `role`. |
| `CardSubmission` | Text input with character limit, submit button, suggestion chips. |
| `RankingBoard` | Drag-and-drop list of 5 cards. Reusable for ranking, guessing, and personal ranking. |
| `AuthorshipGuess` | Cards with dropdowns to assign player names or "auto-generated". |
| `RevealScreen` | Animated comparison of true ranking vs. guesses, score tallying. |
| `GameOverScreen` | Final scores, superlatives, play-again option. |
| `WaitingIndicator` | "Waiting for X..." with status of who has submitted. |
| `PlayerList` | Reusable list showing players, their roles, connection status. |
| `Timer` | Optional countdown for phases (if implementing time limits). |

#### The Ranking Board (Key UX Component)

This is the most important interactive element — used in 3-4 different phases.

**Requirements:**
- Display 5 cards in a vertical list.
- Players drag cards to reorder them. Position 1 (top) = rank 1.
- Must work on both desktop (mouse drag) and mobile (touch drag).
- Visual feedback: card lifts on drag, drop zone highlights, smooth animation on reorder.
- Confirmation button: "Lock in ranking" — no accidental submissions.
- In **collective mode guessing**, this component needs to be collaborative (all guessers see the same board and can rearrange it). This requires real-time sync of the shared ranking state via WebSocket.

**Implementation with @dnd-kit:**
- `DndContext` wraps the sortable list.
- `SortableContext` with `verticalListSortingStrategy`.
- Each card is a `useSortable` item.
- `onDragEnd` reorders the local state array.
- For collective mode: `onDragEnd` also emits the new order to the server, which broadcasts it to all guessers in real-time.

### Responsive Design

Players will primarily use phones (sharing a code in person or via text). The UI must be **mobile-first**:
- Cards should be full-width on small screens with large touch targets.
- Drag-and-drop must work smoothly with touch.
- Text input should work well with on-screen keyboards (no layout shifts).
- The lobby join code should be large and easy to read/share.
- Consider viewport height carefully — avoid layouts that require scrolling during drag operations.

---

## 5. Data Flow Per Phase

### Phase: Card Submission

```
Guesser client                    Server                         Ranker client
     │                              │                                  │
     │── submit-card {text} ───────►│                                  │
     │                              │── player-submitted {id} ────────►│
     │                              │── player-submitted {id} ────────►│ (other guessers)
     │                              │                                  │
     │                   [all cards received]                          │
     │                              │── auto-fill remaining cards      │
     │                              │── shuffle all 5 cards            │
     │                              │                                  │
     │                              │── phase-changed {ranker_view,    │
     │                              │     cards: [{id, text}...]} ────►│
     │◄── phase-changed {waiting} ──│                                  │
```

**Key**: The server never sends card authorship info to anyone until the authorship reveal. Cards are identified only by `id` and `text`.

### Phase: Guessing (Individual Mode)

```
Guesser A                         Server                         Guesser B
     │                              │                                  │
     │── submit-guess [c3,c1,...] ─►│                                  │
     │                              │── player-submitted {A} ─────────►│
     │                              │                                  │
     │                              │◄── submit-guess [c1,c3,...] ─────│
     │◄── player-submitted {B} ─────│                                  │
     │                              │                                  │
     │                   [all guesses received]                        │
     │                              │── phase-changed {reveal} ───────►│
     │◄── phase-changed {reveal} ───│                                  │
```

### Phase: Guessing (Collective Mode)

```
Guesser A                         Server                         Guesser B
     │                              │                                  │
     │── update-collective-guess    │                                  │
     │     [c3,c1,c5,c2,c4] ──────►│                                  │
     │                              │── collective-guess-updated       │
     │                              │     [c3,c1,c5,c2,c4] ──────────►│
     │                              │                                  │
     │                              │◄── update-collective-guess       │
     │                              │     [c1,c3,c5,c2,c4] ───────────│
     │◄── collective-guess-updated  │                                  │
     │     [c1,c3,c5,c2,c4] ───────│                                  │
     │                              │                                  │
     │── lock-collective-guess ────►│  (any guesser or host confirms) │
     │                              │── phase-changed {reveal} ───────►│
     │◄── phase-changed {reveal} ───│                                  │
```

The collective guess board is a shared, live-updating artifact. Any guesser can rearrange it, and changes are broadcast to all. A "lock in" action (by any guesser or the host) finalizes it.

---

## 6. Scoring Engine

### Core Scoring (Per Round)

```typescript
function calculateScore(trueRanking: string[], guessedRanking: string[]): number {
  let score = 0;
  for (let i = 0; i < 5; i++) {
    if (trueRanking[i] === guessedRanking[i]) {
      score++;
    }
  }
  return score; // 0 to 5
}
```

### Authorship Bonus Scoring

```typescript
function calculateAuthorshipScore(
  guesses: Map<string, string>,  // cardId -> guessed authorId | "auto"
  truth: Map<string, string | null>  // cardId -> actual authorId | null
): number {
  let bonus = 0;
  for (const [cardId, guessedAuthor] of guesses) {
    const trueAuthor = truth.get(cardId);
    if (trueAuthor === null && guessedAuthor === "auto") bonus++;
    else if (trueAuthor === guessedAuthor) bonus++;
  }
  return bonus; // 0 to 5
}
```

### Ranker Predictability Stats

After each round, record the best score achieved against that ranker:

```typescript
// In individual mode: average of all guessers' scores
// In collective mode: the group's score
rankerStats.get(rankerId).push(roundScoreAgainstThem);
```

At game end:
- **Most Predictable**: ranker with highest average score against them.
- **Least Predictable**: ranker with lowest average score against them.

### Leaderboard

In individual mode, the leaderboard is simply `scores` sorted descending. Display after each round and at game end.

---

## 7. Security & Cheating Prevention

Since this is a casual friend game, heavy anti-cheat isn't needed, but basic integrity is important:

### Server-Side Validation
- **Phase enforcement**: reject submissions that arrive during the wrong phase.
- **Role enforcement**: only the ranker can submit rankings; only guessers can submit guesses.
- **Single submission**: reject duplicate submissions from the same player in the same phase.
- **Format validation**: rankings must contain exactly 5 card IDs, all unique, all valid for the current round.

### Information Hiding
- The ranker's ranking is stored server-side only. It is never sent to guesser clients until the reveal phase.
- Card authorship is stored server-side only. It is never included in card data sent to any client until the authorship reveal.
- Auto-generated cards are not flagged as such in any client-facing data.

### Join Code Security
- Codes expire when the game ends or after inactivity timeout.
- Optional: rate-limit join attempts to prevent brute-force code guessing (though with 456K codes and short-lived sessions, this is low risk).

---

## 8. Deployment & Hosting

### Recommended Hosting: Railway

**Railway** is the best fit for this project:

- **WebSocket support**: First-class support for long-lived WebSocket connections (critical for this game). Some platforms (like Vercel, Netlify) are serverless and don't support persistent WebSocket connections at all.
- **Simple deployment**: Connect your GitHub repo, Railway auto-deploys on push. Zero DevOps.
- **Single service**: The Node.js server serves both the API/WebSocket and the built React frontend as static files — one deployment, one service.
- **Free tier / cheap**: The Hobby plan ($5/month) is more than enough. Usage-based pricing means you only pay for what you use.
- **Automatic HTTPS**: TLS certificates are provisioned automatically, so WebSocket connections use secure WSS.
- **Custom domains**: Easy to attach a custom domain if you want.

### Why Not Other Platforms?

| Platform | Issue for This Project |
|----------|----------------------|
| **Vercel / Netlify** | Serverless — no persistent WebSocket connections. Would require a separate WebSocket server elsewhere, adding complexity. |
| **Heroku** | Works, but more expensive and slower deploys than Railway. Also shutting down free tier. |
| **Render** | Good alternative to Railway. Supports WebSockets. Slightly slower cold starts on free tier. A solid second choice. |
| **Fly.io** | Works well, but more complex setup (Docker-based). Better suited if you need multi-region, which you don't. |
| **AWS / GCP / Azure** | Massive overkill. You'd be configuring load balancers, EC2 instances, and networking for a game that runs on one process. |
| **A VPS (DigitalOcean, Linode)** | Works, but you manage the server yourself — updates, TLS certs, process managers, etc. More hassle than Railway for no real benefit here. |

### Deployment Setup

```
1. Build the React frontend: `npm run build` (outputs static files to client/dist/)
2. The Express server serves client/dist/ as static files
3. The same server handles Socket.IO connections
4. Deploy as a single Node.js service on Railway
5. Set the start command: `node server/dist/index.js`
6. Railway provisions a URL (e.g., your-game.up.railway.app)
```

### Estimated Resource Needs

- Each lobby uses negligible memory (~10-50 KB of state).
- WebSocket connections: 3-6 per lobby. Even 1000 concurrent lobbies = 6000 connections, easily handled by a single Node.js process.
- No CPU-intensive operations. The server is mostly just routing messages and doing simple array comparisons.
- **Cost estimate**: Well within Railway's Hobby plan. Likely under $5/month even with regular use among friends.

### Scaling (If Needed Later)

- **Multiple server instances**: Would require sticky sessions (so all players in a lobby connect to the same server) or shared state via Redis + Socket.IO Redis adapter.
- **Horizontal scaling**: Redis pub/sub bridges Socket.IO events across instances.
- Not needed for v1 — a single instance handles thousands of concurrent players.

---

## 9. Project Structure

```
priorities/
├── client/                        # React frontend
│   ├── src/
│   │   ├── main.tsx               # Entry point
│   │   ├── App.tsx                # Root component, socket connection, phase router
│   │   ├── context/
│   │   │   └── GameContext.tsx     # React context for game state
│   │   ├── hooks/
│   │   │   ├── useSocket.ts       # Socket.IO connection hook
│   │   │   └── useGameState.ts    # Game state reducer hook
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── LobbyScreen.tsx
│   │   │   ├── CardSubmissionScreen.tsx
│   │   │   ├── AuthorshipGuessScreen.tsx
│   │   │   ├── AuthorshipRevealScreen.tsx
│   │   │   ├── RankingScreen.tsx
│   │   │   ├── GuessingScreen.tsx
│   │   │   ├── PersonalRankingScreen.tsx
│   │   │   ├── RevealScreen.tsx
│   │   │   └── GameOverScreen.tsx
│   │   ├── components/
│   │   │   ├── RankingBoard.tsx    # Drag-and-drop reusable ranking UI
│   │   │   ├── Card.tsx           # Single card display
│   │   │   ├── PlayerList.tsx
│   │   │   ├── WaitingIndicator.tsx
│   │   │   ├── ScoreBoard.tsx
│   │   │   └── Timer.tsx
│   │   └── styles/
│   │       └── globals.css        # Tailwind imports
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── package.json
│
├── server/                        # Node.js backend
│   ├── src/
│   │   ├── index.ts               # Entry point: Express + Socket.IO setup
│   │   ├── lobby.ts               # Lobby creation, joining, code generation
│   │   ├── game.ts                # Game state machine, phase transitions
│   │   ├── scoring.ts             # Score calculation functions
│   │   ├── cards.ts               # Auto-generated card pool + generation logic
│   │   ├── types.ts               # Shared TypeScript interfaces
│   │   └── handlers/
│   │       ├── lobbyHandlers.ts   # Socket event handlers for lobby actions
│   │       └── gameHandlers.ts    # Socket event handlers for game actions
│   ├── tsconfig.json
│   └── package.json
│
├── shared/                        # Shared types between client and server
│   └── types.ts                   # GamePhase, Player, Card, event payload types
│
├── gameplay.md
├── research.md
└── package.json                   # Root workspace config
```

---

## 10. Reveal Screen UX (The Most Important Screen)

The reveal is the climax of each round and deserves the most polish. Here's how it should work:

### Ranking Reveal (Core)

1. Show all 5 cards in a neutral list.
2. Reveal the ranker's ranking one position at a time, starting from #5 (least) to #1 (most), building suspense.
3. For each position revealed, highlight whether guessers got it right:
   - **Individual mode**: Show each guesser's guess for that position. Green checkmark if correct, red X if wrong.
   - **Collective mode**: Show the group's guess. Green/red.
4. After all 5 are revealed, show the total score.

### Authorship Reveal (If Enabled)

- After ranking reveal, show each card with:
  - What the ranker guessed (player name or "auto-generated").
  - The truth (actual author or "auto-generated").
  - Green/red indicator.

### Personal Ranking Comparison (If Enabled)

- A **matrix/grid view**: rows = card positions (1-5), columns = players.
- Each cell shows which card that player put in that position.
- Highlight agreements (where multiple players ranked the same card in the same spot).
- Show "alignment score" between each pair of players — how similarly they ranked.

### Animation & Timing

- Each reveal step should have a short delay (1-2 seconds) for dramatic effect.
- Sound effects or visual flourishes for correct/incorrect guesses.
- A "drumroll" moment before the #1 reveal.

---

## 11. Collective Mode: Shared Board Design

The collective guess mode is technically the trickiest UI feature. Multiple players need to collaboratively arrange 5 cards in real-time.

### Approach: Last-Write-Wins with Live Sync

- The server holds the current state of the collective ranking.
- When any guesser drags a card to a new position, the new order is sent to the server.
- The server broadcasts the updated order to all guessers.
- All clients re-render the board with the new order.
- **Conflict resolution**: last write wins. If two players drag simultaneously, the last event the server processes is the final state. This is acceptable because:
  - Only 2-5 guessers are collaborating.
  - They're friends, likely in the same room or on a call.
  - The UI updates are near-instant, so conflicts are rare.

### Lock-In Mechanism

- Any guesser can press "Lock In" to submit the current collective ranking.
- Alternatively, require a majority vote or host confirmation.
- Simplest v1: any guesser can lock it in, with a 3-second countdown that others can cancel.

---

## 12. Auto-Generated Card Strategy

### Free-Form Mode (Default)

Since there's no prompt, auto-generated cards need to be generic but fun. Categories to draw from:
- **Foods**: "sushi", "cold pizza at 2am", "gas station hot dog"
- **Activities**: "napping", "doomscrolling", "karaoke"
- **Hot takes**: "pineapple on pizza", "the movie was better than the book"
- **Random objects**: "a really good pen", "noise-cancelling headphones"
- **Experiences**: "finding money in your pocket", "a perfect parking spot"

The pool should have 500+ entries across varied categories. Randomly sample without replacement within a game session.

### Prompt Mode (Optional)

When a prompt like "Best pizza toppings" is active, auto-generated cards must match the topic. Options:
1. **Pre-built per-prompt pools**: For each prompt in the library, maintain a list of 10-20 relevant cards. Simple but requires manual curation.
2. **LLM generation at runtime**: Send the prompt + player submissions to an LLM and ask for complementary cards. Higher quality but adds latency and cost.

For v1, stick with pre-built pools. Each prompt in the library comes with its own card pool.

---

## 13. Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebSocket disconnection mid-game | Player can't submit, game stalls | Grace period + auto-reconnect + timeout with default submission |
| Collective mode drag conflicts | Janky UX if two people drag at once | Last-write-wins + debounce (50ms) + visual indicator of who's dragging |
| Mobile browser backgrounding | WebSocket drops when phone sleeps | Socket.IO auto-reconnect + server holds state + rejoin with lobby code |
| Free-form auto-generated cards feel out of place | Breaks immersion, easy to spot | Large diverse card pool + playtesting to refine |
| Host leaves mid-game | Game orphaned | Auto-transfer host to next player |
| Slow phase transitions | Players waiting with nothing to do | Show progress ("3/4 submitted"), add optional timer per phase |

---

## 14. Implementation Priority (Build Order)

For iterative development, build in this order:

### Phase 1: Core Loop (MVP)
1. Lobby creation + join code + player list
2. Round start + ranker assignment
3. Card submission (player-written only, no auto-fill yet)
4. Ranking screen (drag-to-rank)
5. Guessing screen (individual mode only)
6. Reveal screen (basic, no animation)
7. Score tracking + game over screen

### Phase 2: Complete Features
8. Auto-generated cards (pre-built pool)
9. Collective guessing mode (shared board)
10. Authorship guessing + reveal
11. Personal ranking mode + comparison view

### Phase 3: Polish
12. Animated reveals (sequential position reveal)
13. Disconnection handling + reconnect
14. Timer per phase (optional)
15. Responsive mobile polish
16. Sound effects / haptics

### Phase 4: Optional Enhancements
17. Prompt/category system
18. LLM-generated cards
19. Game history / replay
20. Share results (screenshot or link)
