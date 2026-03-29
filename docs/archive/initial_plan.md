# Implementation Plan: Priorities

A step-by-step build plan for the Priorities ranking game, organized into implementable steps with code snippets. Each step produces a working (if incomplete) application.

---

## Table of Contents

- [Step 0: Project Scaffolding](#step-0-project-scaffolding)
- [Step 1: Shared Types](#step-1-shared-types)
- [Step 2: Server — Entry Point & Socket.IO Setup](#step-2-server--entry-point--socketio-setup)
- [Step 3: Server — Lobby System](#step-3-server--lobby-system)
- [Step 4: Client — Home Screen & Lobby Screen](#step-4-client--home-screen--lobby-screen)
- [Step 5: Server — Game State Machine & Round Flow](#step-5-server--game-state-machine--round-flow)
- [Step 6: Server — Card Submission & Auto-Fill](#step-6-server--card-submission--auto-fill)
- [Step 7: Client — Card Submission Screen](#step-7-client--card-submission-screen)
- [Step 8: Server — Ranking & Guessing Handlers](#step-8-server--ranking--guessing-handlers)
- [Step 9: Client — Ranking Board Component (Drag-and-Drop)](#step-9-client--ranking-board-component-drag-and-drop)
- [Step 10: Client — Ranking & Guessing Screens](#step-10-client--ranking--guessing-screens)
- [Step 11: Server — Scoring & Reveal](#step-11-server--scoring--reveal)
- [Step 12: Client — Reveal Screen](#step-12-client--reveal-screen)
- [Step 13: Server — Game Over & Multi-Round](#step-13-server--game-over--multi-round)
- [Step 14: Client — Game Over Screen](#step-14-client--game-over-screen)
- [Step 15: Collective Guessing Mode](#step-15-collective-guessing-mode)
- [Step 16: Authorship Guessing](#step-16-authorship-guessing)
- [Step 17: Personal Ranking Mode](#step-17-personal-ranking-mode)
- [Step 18: Disconnection Handling](#step-18-disconnection-handling)
- [Step 19: Polish & Animations](#step-19-polish--animations)
- [Step 20: Deployment](#step-20-deployment)

---

## Step 0: Project Scaffolding

Initialize the monorepo structure, install dependencies, and configure TypeScript and build tools.

### Directory structure

```
priorities/
├── client/          # React + Vite frontend
├── server/          # Node.js + Express + Socket.IO backend
├── shared/          # Shared TypeScript types
├── package.json     # Root workspace config
└── tsconfig.base.json
```

### Root package.json (workspace config)

```json
{
  "name": "priorities",
  "private": true,
  "workspaces": ["client", "server", "shared"],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client",
    "build": "npm run build --workspace=shared && npm run build --workspace=client && npm run build --workspace=server",
    "start": "npm run start --workspace=server"
  },
  "devDependencies": {
    "concurrently": "^9.0.0",
    "typescript": "^5.5.0"
  }
}
```

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

### Server setup

```bash
# server/package.json dependencies
npm init -y --workspace=server
cd server
npm install express socket.io cors uuid
npm install -D @types/express @types/cors @types/uuid tsx nodemon
```

**server/tsconfig.json:**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../shared" }]
}
```

**server/package.json scripts:**

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### Client setup

```bash
# Create Vite React project
npm create vite@latest client -- --template react-ts
cd client
npm install socket.io-client @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D tailwindcss @tailwindcss/vite
```

**client/vite.config.ts:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
});
```

**client/src/styles/globals.css:**

```css
@import "tailwindcss";
```

### Shared types setup

```bash
mkdir shared
cd shared && npm init -y
```

**shared/tsconfig.json:**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"]
}
```

### Milestone: `npm run dev` starts both client (Vite on :5173) and server (tsx on :3000). Both compile without errors. Client proxies WebSocket to server.

---

## Step 1: Shared Types

Define all types used by both client and server. This is the contract between frontend and backend.

### shared/src/types.ts

```typescript
// --- Game Phases ---
export type GamePhase =
  | 'lobby'
  | 'card_submission'
  | 'authorship_guess'
  | 'authorship_reveal'
  | 'ranking'
  | 'guessing'
  | 'personal_ranking'
  | 'reveal'
  | 'game_over';

// --- Settings ---
export interface GameSettings {
  guessingMode: 'collective' | 'individual';
  authorshipGuess: boolean;
  personalRanking: boolean;
  promptsEnabled: boolean;
  roundCount: number;
}

// --- Player ---
export interface Player {
  id: string;
  displayName: string;
  isHost: boolean;
  connected: boolean;
}

// --- Card (client-facing, no authorship info) ---
export interface CardPublic {
  id: string;
  text: string;
}

// --- Card (server-only, with authorship) ---
export interface CardFull extends CardPublic {
  authorId: string | null; // null = auto-generated
}

// --- Round Result ---
export interface RoundResult {
  roundNumber: number;
  rankerId: string;
  cards: CardPublic[];
  trueRanking: string[];            // card IDs in rank order
  guesses: Record<string, string[]>; // playerId -> guessed ranking (individual)
  collectiveGuess: string[] | null;
  scores: Record<string, number>;    // playerId -> points this round
  authorship?: Record<string, string | null>; // cardId -> authorId
  authorshipGuesses?: Record<string, string>; // cardId -> guessed authorId
  authorshipScore?: number;
  personalRankings?: Record<string, string[]>; // playerId -> personal ranking
}

// --- Lobby State (sent to clients) ---
export interface LobbyState {
  lobbyCode: string;
  hostId: string;
  settings: GameSettings;
  players: Player[];
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  currentRankerId: string | null;
  cards: CardPublic[];               // empty until cards are dealt
  submittedPlayerIds: string[];      // who has submitted in current phase
  collectiveGuessOrder: string[];    // live collective board state
}

// --- Client → Server Events ---
export interface ClientEvents {
  'create-lobby': (data: { displayName: string; settings: GameSettings }) => void;
  'join-lobby': (data: { code: string; displayName: string }) => void;
  'update-settings': (data: { settings: Partial<GameSettings> }) => void;
  'start-game': () => void;
  'submit-card': (data: { text: string }) => void;
  'submit-ranking': (data: { ranking: string[] }) => void;
  'submit-guess': (data: { ranking: string[] }) => void;
  'submit-authorship-guess': (data: { guesses: Record<string, string> }) => void;
  'submit-personal-ranking': (data: { ranking: string[] }) => void;
  'update-collective-guess': (data: { ranking: string[] }) => void;
  'lock-collective-guess': () => void;
  'next-round': () => void;
}

// --- Server → Client Events ---
export interface ServerEvents {
  'lobby-created': (data: { lobbyCode: string; playerId: string }) => void;
  'lobby-joined': (data: { playerId: string }) => void;
  'lobby-updated': (data: LobbyState) => void;
  'phase-changed': (data: LobbyState) => void;
  'player-submitted': (data: { playerId: string }) => void;
  'collective-guess-updated': (data: { ranking: string[] }) => void;
  'reveal-results': (data: RoundResult) => void;
  'game-over': (data: {
    finalScores: Record<string, number>;
    roundHistory: RoundResult[];
    superlatives: {
      mostPredictable: { playerId: string; avgScore: number } | null;
      leastPredictable: { playerId: string; avgScore: number } | null;
      bestGuesser: { playerId: string; totalScore: number } | null;
    };
  }) => void;
  'error': (data: { message: string }) => void;
}
```

### Milestone: Both client and server can import from `shared/src/types.ts`. All game concepts have a concrete type.

---

## Step 2: Server — Entry Point & Socket.IO Setup

Create the Express + Socket.IO server with typed events.

### server/src/index.ts

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerLobbyHandlers } from './handlers/lobbyHandlers.js';
import { registerGameHandlers } from './handlers/gameHandlers.js';
import type { ClientEvents, ServerEvents } from '../../shared/src/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173',
  },
  pingInterval: 25000,
  pingTimeout: 20000,
});

app.use(cors());

// In production, serve the built React app
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  registerLobbyHandlers(io, socket);
  registerGameHandlers(io, socket);

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    // Handled in Step 18
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Milestone: Server starts, accepts Socket.IO connections, serves health check at `/api/health`.

---

## Step 3: Server — Lobby System

Manage lobby creation, joining, code generation, and settings.

### server/src/lobby.ts

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { GameSettings, GamePhase, CardFull, Player } from '../../shared/src/types.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface ServerGameState {
  lobbyCode: string;
  hostId: string;
  settings: GameSettings;
  players: Map<string, Player>;
  phase: GamePhase;
  currentRound: number;
  rankerOrder: string[];
  currentRankerId: string | null;
  cards: CardFull[];
  rankerRanking: string[] | null;
  guesses: Map<string, string[]>;
  collectiveGuess: string[] | null;
  authorshipGuesses: Record<string, string> | null;
  personalRankings: Map<string, string[]>;
  scores: Map<string, number>;
  rankerStats: Map<string, number[]>;
  roundHistory: any[];
  submittedPlayerIds: Set<string>;
}

// All active lobbies, keyed by lobby code
export const lobbies = new Map<string, ServerGameState>();

// Map socket ID -> lobby code for quick lookup
export const socketToLobby = new Map<string, string>();

export function generateLobbyCode(): string {
  let code: string;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (lobbies.has(code));
  return code;
}

export function createLobby(hostSocketId: string, displayName: string, settings: GameSettings): ServerGameState {
  const code = generateLobbyCode();
  const player: Player = {
    id: hostSocketId,
    displayName,
    isHost: true,
    connected: true,
  };

  const state: ServerGameState = {
    lobbyCode: code,
    hostId: hostSocketId,
    settings,
    players: new Map([[hostSocketId, player]]),
    phase: 'lobby',
    currentRound: 0,
    rankerOrder: [],
    currentRankerId: null,
    cards: [],
    rankerRanking: null,
    guesses: new Map(),
    collectiveGuess: null,
    authorshipGuesses: null,
    personalRankings: new Map(),
    scores: new Map([[hostSocketId, 0]]),
    rankerStats: new Map(),
    roundHistory: [],
    submittedPlayerIds: new Set(),
  };

  lobbies.set(code, state);
  socketToLobby.set(hostSocketId, code);
  return state;
}

export function joinLobby(code: string, socketId: string, displayName: string): ServerGameState | null {
  const state = lobbies.get(code);
  if (!state) return null;
  if (state.phase !== 'lobby') return null;
  if (state.players.size >= 6) return null;

  const player: Player = {
    id: socketId,
    displayName,
    isHost: false,
    connected: true,
  };

  state.players.set(socketId, player);
  state.scores.set(socketId, 0);
  socketToLobby.set(socketId, code);
  return state;
}

export function getLobbyForSocket(socketId: string): ServerGameState | null {
  const code = socketToLobby.get(socketId);
  if (!code) return null;
  return lobbies.get(code) || null;
}

// Convert server state to the client-safe LobbyState (strips authorship, etc.)
export function toLobbyState(state: ServerGameState) {
  return {
    lobbyCode: state.lobbyCode,
    hostId: state.hostId,
    settings: state.settings,
    players: Array.from(state.players.values()),
    phase: state.phase,
    currentRound: state.currentRound,
    totalRounds: state.settings.roundCount,
    currentRankerId: state.currentRankerId,
    cards: state.cards.map((c) => ({ id: c.id, text: c.text })),
    submittedPlayerIds: Array.from(state.submittedPlayerIds),
    collectiveGuessOrder: state.collectiveGuess || [],
  };
}
```

### server/src/handlers/lobbyHandlers.ts

```typescript
import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types.js';
import { createLobby, joinLobby, getLobbyForSocket, toLobbyState } from '../lobby.js';

export function registerLobbyHandlers(
  io: Server<ClientEvents, ServerEvents>,
  socket: Socket<ClientEvents, ServerEvents>
) {
  socket.on('create-lobby', ({ displayName, settings }) => {
    const state = createLobby(socket.id, displayName, settings);
    socket.join(state.lobbyCode);
    socket.emit('lobby-created', { lobbyCode: state.lobbyCode, playerId: socket.id });
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });

  socket.on('join-lobby', ({ code, displayName }) => {
    const state = joinLobby(code.toUpperCase(), socket.id, displayName);
    if (!state) {
      socket.emit('error', { message: 'Lobby not found, full, or game already started.' });
      return;
    }
    socket.join(state.lobbyCode);
    socket.emit('lobby-joined', { playerId: socket.id });
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });

  socket.on('update-settings', ({ settings }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.hostId !== socket.id || state.phase !== 'lobby') return;
    Object.assign(state.settings, settings);
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));
  });
}
```

### Milestone: Players can create lobbies (get a 4-char code), join by code, and see each other in the player list. Host can change settings. Everything syncs in real time.

---

## Step 4: Client — Home Screen & Lobby Screen

### client/src/hooks/useSocket.ts

```typescript
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: TypedSocket = io({
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connected };
}
```

### client/src/context/GameContext.tsx

```tsx
import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { LobbyState, RoundResult } from '../../../shared/src/types';
import type { Socket } from 'socket.io-client';

interface GameContextState {
  playerId: string | null;
  displayName: string;
  lobbyState: LobbyState | null;
  roundResult: RoundResult | null;
  gameOverData: any | null;
}

type Action =
  | { type: 'SET_PLAYER'; playerId: string; displayName: string }
  | { type: 'SET_LOBBY'; lobby: LobbyState }
  | { type: 'SET_ROUND_RESULT'; result: RoundResult }
  | { type: 'SET_GAME_OVER'; data: any }
  | { type: 'PLAYER_SUBMITTED'; playerId: string }
  | { type: 'COLLECTIVE_GUESS_UPDATED'; ranking: string[] }
  | { type: 'RESET' };

const initialState: GameContextState = {
  playerId: null,
  displayName: '',
  lobbyState: null,
  roundResult: null,
  gameOverData: null,
};

function reducer(state: GameContextState, action: Action): GameContextState {
  switch (action.type) {
    case 'SET_PLAYER':
      return { ...state, playerId: action.playerId, displayName: action.displayName };
    case 'SET_LOBBY':
      return { ...state, lobbyState: action.lobby, roundResult: null };
    case 'SET_ROUND_RESULT':
      return { ...state, roundResult: action.result };
    case 'SET_GAME_OVER':
      return { ...state, gameOverData: action.data };
    case 'PLAYER_SUBMITTED':
      if (!state.lobbyState) return state;
      return {
        ...state,
        lobbyState: {
          ...state.lobbyState,
          submittedPlayerIds: [...state.lobbyState.submittedPlayerIds, action.playerId],
        },
      };
    case 'COLLECTIVE_GUESS_UPDATED':
      if (!state.lobbyState) return state;
      return {
        ...state,
        lobbyState: { ...state.lobbyState, collectiveGuessOrder: action.ranking },
      };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const GameContext = createContext<{
  state: GameContextState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function GameProvider({ children, socket }: { children: ReactNode; socket: Socket | null }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!socket) return;

    socket.on('lobby-created', ({ playerId }) => {
      dispatch({ type: 'SET_PLAYER', playerId, displayName: state.displayName });
    });

    socket.on('lobby-joined', ({ playerId }) => {
      dispatch({ type: 'SET_PLAYER', playerId, displayName: state.displayName });
    });

    socket.on('lobby-updated', (lobby) => {
      dispatch({ type: 'SET_LOBBY', lobby });
    });

    socket.on('phase-changed', (lobby) => {
      dispatch({ type: 'SET_LOBBY', lobby });
    });

    socket.on('player-submitted', ({ playerId }) => {
      dispatch({ type: 'PLAYER_SUBMITTED', playerId });
    });

    socket.on('collective-guess-updated', ({ ranking }) => {
      dispatch({ type: 'COLLECTIVE_GUESS_UPDATED', ranking });
    });

    socket.on('reveal-results', (result) => {
      dispatch({ type: 'SET_ROUND_RESULT', result });
    });

    socket.on('game-over', (data) => {
      dispatch({ type: 'SET_GAME_OVER', data });
    });

    return () => {
      socket.off('lobby-created');
      socket.off('lobby-joined');
      socket.off('lobby-updated');
      socket.off('phase-changed');
      socket.off('player-submitted');
      socket.off('collective-guess-updated');
      socket.off('reveal-results');
      socket.off('game-over');
    };
  }, [socket]);

  return <GameContext.Provider value={{ state, dispatch }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
```

### client/src/screens/HomeScreen.tsx

```tsx
import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { GameSettings } from '../../../shared/src/types';

const DEFAULT_SETTINGS: GameSettings = {
  guessingMode: 'individual',
  authorshipGuess: false,
  personalRanking: false,
  promptsEnabled: false,
  roundCount: 0, // 0 = auto (one per player)
};

export function HomeScreen({ socket }: { socket: Socket }) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');

  const handleCreate = () => {
    if (!name.trim()) return;
    socket.emit('create-lobby', { displayName: name.trim(), settings: DEFAULT_SETTINGS });
  };

  const handleJoin = () => {
    if (!name.trim() || !joinCode.trim()) return;
    socket.emit('join-lobby', { code: joinCode.trim().toUpperCase(), displayName: name.trim() });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-6">
      <h1 className="text-4xl font-bold">Priorities</h1>

      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        className="w-full max-w-xs px-4 py-3 border-2 rounded-xl text-center text-lg"
      />

      {mode === 'menu' ? (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={handleCreate} disabled={!name.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-lg font-medium disabled:opacity-50">
            Create Lobby
          </button>
          <button onClick={() => setMode('join')} disabled={!name.trim()}
            className="px-6 py-3 bg-gray-200 rounded-xl text-lg font-medium disabled:opacity-50">
            Join Lobby
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <input
            type="text"
            placeholder="Enter code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={4}
            className="px-4 py-3 border-2 rounded-xl text-center text-2xl tracking-widest font-mono"
          />
          <button onClick={handleJoin} disabled={!name.trim() || joinCode.length < 4}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-lg font-medium disabled:opacity-50">
            Join
          </button>
          <button onClick={() => setMode('menu')} className="text-gray-500 underline">Back</button>
        </div>
      )}
    </div>
  );
}
```

### client/src/screens/LobbyScreen.tsx

```tsx
import type { Socket } from 'socket.io-client';
import { useGame } from '../context/GameContext';
import type { GameSettings } from '../../../shared/src/types';

export function LobbyScreen({ socket }: { socket: Socket }) {
  const { state } = useGame();
  const lobby = state.lobbyState!;
  const isHost = state.playerId === lobby.hostId;

  const handleStart = () => socket.emit('start-game');

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    socket.emit('update-settings', { settings: { [key]: value } });
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-6 gap-6">
      <h2 className="text-2xl font-bold">Lobby</h2>

      {/* Join Code */}
      <div className="text-center">
        <p className="text-sm text-gray-500 uppercase tracking-wide">Share this code</p>
        <p className="text-5xl font-mono font-bold tracking-widest mt-1">{lobby.lobbyCode}</p>
      </div>

      {/* Player List */}
      <div className="w-full max-w-sm">
        <h3 className="font-semibold mb-2">Players ({lobby.players.length}/6)</h3>
        <ul className="space-y-2">
          {lobby.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
              <span className="flex-1">{p.displayName}</span>
              {p.id === lobby.hostId && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Host</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Settings (host only) */}
      {isHost && (
        <div className="w-full max-w-sm space-y-3">
          <h3 className="font-semibold">Settings</h3>

          <label className="flex items-center justify-between">
            <span>Guessing Mode</span>
            <select
              value={lobby.settings.guessingMode}
              onChange={(e) => updateSetting('guessingMode', e.target.value as any)}
              className="border rounded px-2 py-1"
            >
              <option value="individual">Individual</option>
              <option value="collective">Collective</option>
            </select>
          </label>

          <label className="flex items-center justify-between">
            <span>Ranker Guesses Authorship</span>
            <input type="checkbox" checked={lobby.settings.authorshipGuess}
              onChange={(e) => updateSetting('authorshipGuess', e.target.checked)} />
          </label>

          <label className="flex items-center justify-between">
            <span>Personal Ranking</span>
            <input type="checkbox" checked={lobby.settings.personalRanking}
              onChange={(e) => updateSetting('personalRanking', e.target.checked)} />
          </label>
        </div>
      )}

      {/* Start Button */}
      {isHost && (
        <button onClick={handleStart} disabled={lobby.players.length < 3}
          className="px-8 py-3 bg-green-600 text-white rounded-xl text-lg font-medium disabled:opacity-50">
          Start Game ({lobby.players.length < 3 ? `Need ${3 - lobby.players.length} more` : 'Ready!'})
        </button>
      )}

      {!isHost && (
        <p className="text-gray-500">Waiting for host to start...</p>
      )}
    </div>
  );
}
```

### client/src/App.tsx

```tsx
import { useSocket } from './hooks/useSocket';
import { GameProvider, useGame } from './context/GameContext';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
// Other screens imported as they're built

function GameRouter({ socket }: { socket: any }) {
  const { state } = useGame();

  if (!state.lobbyState) {
    return <HomeScreen socket={socket} />;
  }

  switch (state.lobbyState.phase) {
    case 'lobby':
      return <LobbyScreen socket={socket} />;
    case 'card_submission':
      return <div>Card Submission (Step 7)</div>;
    case 'ranking':
      return <div>Ranking (Step 10)</div>;
    case 'guessing':
      return <div>Guessing (Step 10)</div>;
    case 'reveal':
      return <div>Reveal (Step 12)</div>;
    case 'game_over':
      return <div>Game Over (Step 14)</div>;
    default:
      return <div>Phase: {state.lobbyState.phase}</div>;
  }
}

export default function App() {
  const { socket, connected } = useSocket();

  if (!socket || !connected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Connecting...</p>
      </div>
    );
  }

  return (
    <GameProvider socket={socket}>
      <GameRouter socket={socket} />
    </GameProvider>
  );
}
```

### Milestone: Full lobby flow works. Create lobby, see code, share with friends, join, see player list, host configures settings, all synced in real time.

---

## Step 5: Server — Game State Machine & Round Flow

Handle the `start-game` event and the phase transition engine.

### server/src/game.ts

```typescript
import type { ServerGameState } from './lobby.js';
import { getAutoFillCards } from './cards.js';

export function startGame(state: ServerGameState): void {
  const playerIds = Array.from(state.players.keys());

  // Shuffle player order for ranker rotation
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  state.rankerOrder = shuffled;

  // Set round count: default to number of players (everyone ranks once)
  if (state.settings.roundCount === 0) {
    state.settings.roundCount = playerIds.length;
  }

  state.currentRound = 1;
  startRound(state);
}

export function startRound(state: ServerGameState): void {
  // Pick the ranker for this round (cycle through the order)
  const rankerIndex = (state.currentRound - 1) % state.rankerOrder.length;
  state.currentRankerId = state.rankerOrder[rankerIndex];

  // Reset round state
  state.cards = [];
  state.rankerRanking = null;
  state.guesses = new Map();
  state.collectiveGuess = null;
  state.authorshipGuesses = null;
  state.personalRankings = new Map();
  state.submittedPlayerIds = new Set();

  // Move to card submission
  state.phase = 'card_submission';
}

export function advancePhase(state: ServerGameState): void {
  state.submittedPlayerIds = new Set();

  switch (state.phase) {
    case 'card_submission':
      // Auto-fill cards to reach 5
      const needed = 5 - state.cards.length;
      if (needed > 0) {
        const autoCards = getAutoFillCards(needed, state.cards.map((c) => c.text));
        state.cards.push(...autoCards);
      }
      // Shuffle so ranker can't tell which came first
      state.cards.sort(() => Math.random() - 0.5);

      // Next phase depends on settings
      if (state.settings.authorshipGuess) {
        state.phase = 'authorship_guess';
      } else {
        state.phase = 'ranking';
      }
      break;

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
```

### Milestone: `start-game` triggers the state machine. Phase transitions work correctly, skipping optional phases based on settings.

---

## Step 6: Server — Card Submission & Auto-Fill

### server/src/cards.ts

```typescript
import { v4 as uuidv4 } from 'uuid';
import type { CardFull } from '../../shared/src/types.js';

// Pre-built card pool for free-form mode (500+ entries)
const CARD_POOL = [
  // Foods
  'sushi', 'cold pizza at 2am', 'gas station hot dog', 'fresh bread from a bakery',
  'mac and cheese', 'a perfectly ripe avocado', 'street tacos', 'grandma\'s cooking',
  'instant ramen at midnight', 'a charcuterie board', 'gas station sushi',
  'free samples at Costco', 'breakfast for dinner', 'leftover Thanksgiving turkey',

  // Activities
  'napping on a rainy day', 'doomscrolling at 3am', 'karaoke', 'people watching',
  'binge-watching a new show', 'a long hot shower', 'road trip with friends',
  'sleeping in on Saturday', 'cooking a new recipe', 'going to a concert',
  'window shopping', 'doing absolutely nothing', 'a spontaneous adventure',

  // Hot takes / opinions
  'pineapple on pizza', 'the movie was better than the book',
  'waking up early is underrated', 'cereal is a soup',
  'a hot dog is a sandwich', 'water is the best drink',
  'socks with sandals', 'replying-all to an email',

  // Objects
  'a really good pen', 'noise-cancelling headphones', 'a cozy blanket',
  'a brand new pair of socks', 'a fully charged phone', 'the TV remote',
  'a perfect pillow', 'sunglasses', 'a handwritten letter',

  // Experiences
  'finding money in your pocket', 'a perfect parking spot',
  'the smell after rain', 'when your phone is at 100%',
  'cancelling plans', 'the first sip of coffee',
  'when the Wi-Fi connects instantly', 'getting a compliment from a stranger',
  'finishing a really good book', 'the feeling after a workout',
  'a snow day', 'when your favorite song comes on shuffle',
  'popping bubble wrap', 'peeling the plastic off a new screen',

  // MORE entries would go here in production (aim for 500+)
  // Truncated for plan readability
];

// Track used cards per lobby to avoid repeats within a session
const usedCardsPerLobby = new Map<string, Set<string>>();

export function getAutoFillCards(count: number, existingTexts: string[]): CardFull[] {
  const avoid = new Set(existingTexts.map((t) => t.toLowerCase()));
  const available = CARD_POOL.filter((c) => !avoid.has(c.toLowerCase()));

  // Shuffle and pick
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((text) => ({
    id: uuidv4(),
    text,
    authorId: null,
  }));
}

export function createPlayerCard(text: string, authorId: string): CardFull {
  return {
    id: uuidv4(),
    text,
    authorId,
  };
}
```

### Add to server/src/handlers/gameHandlers.ts — card submission handler

```typescript
import type { Server, Socket } from 'socket.io';
import type { ClientEvents, ServerEvents } from '../../../shared/src/types.js';
import { getLobbyForSocket, toLobbyState } from '../lobby.js';
import { createPlayerCard } from '../cards.js';
import { startGame, advancePhase } from '../game.js';

export function registerGameHandlers(
  io: Server<ClientEvents, ServerEvents>,
  socket: Socket<ClientEvents, ServerEvents>
) {
  socket.on('start-game', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.hostId !== socket.id) return;
    if (state.players.size < 3) return;

    startGame(state);
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  });

  socket.on('submit-card', ({ text }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'card_submission') return;
    if (socket.id === state.currentRankerId) return; // ranker can't submit cards
    if (state.submittedPlayerIds.has(socket.id)) return; // already submitted

    state.cards.push(createPlayerCard(text, socket.id));
    state.submittedPlayerIds.add(socket.id);

    // Notify others that someone submitted (no content revealed)
    io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });

    // Check if all non-ranker players have submitted
    const nonRankerCount = state.players.size - 1;
    if (state.submittedPlayerIds.size >= nonRankerCount) {
      advancePhase(state); // -> authorship_guess or ranking
      io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    }
  });

  socket.on('submit-ranking', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'ranking') return;
    if (socket.id !== state.currentRankerId) return;
    if (ranking.length !== 5) return;

    state.rankerRanking = ranking;
    advancePhase(state); // -> guessing
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  });

  socket.on('submit-guess', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'guessing') return;
    if (socket.id === state.currentRankerId) return;
    if (state.submittedPlayerIds.has(socket.id)) return;
    if (ranking.length !== 5) return;

    state.guesses.set(socket.id, ranking);
    state.submittedPlayerIds.add(socket.id);

    io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });

    const nonRankerCount = state.players.size - 1;
    if (state.submittedPlayerIds.size >= nonRankerCount) {
      advancePhase(state); // -> personal_ranking or reveal
      io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    }
  });

  socket.on('submit-personal-ranking', ({ ranking }) => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'personal_ranking') return;
    if (state.submittedPlayerIds.has(socket.id)) return;

    state.personalRankings.set(socket.id, ranking);
    state.submittedPlayerIds.add(socket.id);

    io.to(state.lobbyCode).emit('player-submitted', { playerId: socket.id });

    // All players (including ranker) can submit personal rankings
    if (state.submittedPlayerIds.size >= state.players.size) {
      advancePhase(state); // -> reveal
      io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
    }
  });

  socket.on('next-round', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state || state.phase !== 'reveal') return;
    if (socket.id !== state.hostId) return;

    advancePhase(state); // -> next round's card_submission or game_over
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  });
}
```

### Milestone: Full server-side round flow. Cards submitted, auto-filled to 5, shuffled. Ranker submits ranking. Guessers submit guesses. Phase machine advances correctly.

---

## Step 7: Client — Card Submission Screen

### client/src/screens/CardSubmissionScreen.tsx

```tsx
import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useGame } from '../context/GameContext';

export function CardSubmissionScreen({ socket }: { socket: Socket }) {
  const { state } = useGame();
  const lobby = state.lobbyState!;
  const isRanker = state.playerId === lobby.currentRankerId;
  const [cardText, setCardText] = useState('');
  const hasSubmitted = lobby.submittedPlayerIds.includes(state.playerId!);
  const nonRankerCount = lobby.players.length - 1;

  const handleSubmit = () => {
    if (!cardText.trim()) return;
    socket.emit('submit-card', { text: cardText.trim() });
  };

  if (isRanker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <h2 className="text-2xl font-bold">You are the Ranker!</h2>
        <p className="text-gray-600 text-center">
          Waiting for other players to submit their cards...
        </p>
        <p className="text-lg font-medium">
          {lobby.submittedPlayerIds.length} / {nonRankerCount} submitted
        </p>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <h2 className="text-2xl font-bold">Card Submitted!</h2>
        <p className="text-gray-600">Waiting for other players...</p>
        <p className="text-lg font-medium">
          {lobby.submittedPlayerIds.length} / {nonRankerCount} submitted
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-6">
      <h2 className="text-2xl font-bold">Submit a Card</h2>
      <p className="text-gray-600 text-center">
        Write a word or phrase. The ranker will rank it against 4 others.
      </p>

      <input
        type="text"
        placeholder="Type anything..."
        value={cardText}
        onChange={(e) => setCardText(e.target.value)}
        maxLength={100}
        className="w-full max-w-sm px-4 py-3 border-2 rounded-xl text-lg"
        autoFocus
      />

      <button onClick={handleSubmit} disabled={!cardText.trim()}
        className="px-8 py-3 bg-blue-600 text-white rounded-xl text-lg font-medium disabled:opacity-50">
        Submit Card
      </button>
    </div>
  );
}
```

### Milestone: Non-ranker players see a text input, submit a card, and see a waiting state. The ranker sees a waiting screen with a submission counter.

---

## Step 8: Server — Ranking & Guessing Handlers

Already included in Step 6's `gameHandlers.ts`. The `submit-ranking`, `submit-guess`, `submit-personal-ranking` handlers are all implemented above. No additional server code needed for this step.

### Milestone: Server correctly handles all submission events for ranking, guessing, and personal ranking phases.

---

## Step 9: Client — Ranking Board Component (Drag-and-Drop)

The core reusable component used for ranking, guessing, and personal ranking.

### client/src/components/RankingBoard.tsx

```tsx
import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardPublic } from '../../../shared/src/types';

interface SortableCardProps {
  card: CardPublic;
  rank: number;
}

function SortableCard({ card, rank }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-3 px-4 py-4 bg-white border-2 rounded-xl shadow-sm
        ${isDragging ? 'border-blue-400 shadow-lg' : 'border-gray-200'}
        touch-none select-none cursor-grab active:cursor-grabbing`}
    >
      <span className="text-xl font-bold text-gray-400 w-8 text-center">{rank}</span>
      <span className="flex-1 text-lg">{card.text}</span>
      <span className="text-gray-300 text-2xl">⠿</span>
    </div>
  );
}

interface RankingBoardProps {
  cards: CardPublic[];
  onSubmit: (ranking: string[]) => void;
  submitLabel: string;
  title: string;
  subtitle?: string;
  initialOrder?: string[];              // for collective mode sync
  onOrderChange?: (ranking: string[]) => void; // for collective mode live broadcast
}

export function RankingBoard({
  cards,
  onSubmit,
  submitLabel,
  title,
  subtitle,
  initialOrder,
  onOrderChange,
}: RankingBoardProps) {
  const [orderedIds, setOrderedIds] = useState<string[]>(
    initialOrder || cards.map((c) => c.id)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedIds.indexOf(active.id as string);
    const newIndex = orderedIds.indexOf(over.id as string);
    const newOrder = arrayMove(orderedIds, oldIndex, newIndex);

    setOrderedIds(newOrder);
    onOrderChange?.(newOrder); // broadcast for collective mode
  };

  // Sync with external order changes (collective mode)
  // When initialOrder prop changes, update local state
  // This is handled via useEffect in the parent component

  const orderedCards = orderedIds.map((id) => cards.find((c) => c.id === id)!).filter(Boolean);

  return (
    <div className="flex flex-col items-center min-h-screen p-6 gap-4">
      <h2 className="text-2xl font-bold">{title}</h2>
      {subtitle && <p className="text-gray-600 text-center">{subtitle}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div className="w-full max-w-sm space-y-2">
            {orderedCards.map((card, index) => (
              <SortableCard key={card.id} card={card} rank={index + 1} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={() => onSubmit(orderedIds)}
        className="mt-4 px-8 py-3 bg-green-600 text-white rounded-xl text-lg font-medium"
      >
        {submitLabel}
      </button>
    </div>
  );
}
```

### Milestone: A fully functional drag-and-drop ranking component. Cards can be reordered on both desktop and mobile. Displays rank numbers 1-5. Has a submit button.

---

## Step 10: Client — Ranking & Guessing Screens

### client/src/screens/RankingScreen.tsx

```tsx
import type { Socket } from 'socket.io-client';
import { useGame } from '../context/GameContext';
import { RankingBoard } from '../components/RankingBoard';

export function RankingScreen({ socket }: { socket: Socket }) {
  const { state } = useGame();
  const lobby = state.lobbyState!;
  const isRanker = state.playerId === lobby.currentRankerId;

  if (!isRanker) {
    const ranker = lobby.players.find((p) => p.id === lobby.currentRankerId);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <h2 className="text-2xl font-bold">Ranking in Progress</h2>
        <p className="text-gray-600">{ranker?.displayName} is ranking the cards...</p>
      </div>
    );
  }

  const handleSubmit = (ranking: string[]) => {
    socket.emit('submit-ranking', { ranking });
  };

  return (
    <RankingBoard
      cards={lobby.cards}
      onSubmit={handleSubmit}
      submitLabel="Lock In Ranking"
      title="Rank These Cards"
      subtitle="Drag to reorder. #1 is your top pick."
    />
  );
}
```

### client/src/screens/GuessingScreen.tsx

```tsx
import type { Socket } from 'socket.io-client';
import { useGame } from '../context/GameContext';
import { RankingBoard } from '../components/RankingBoard';

export function GuessingScreen({ socket }: { socket: Socket }) {
  const { state } = useGame();
  const lobby = state.lobbyState!;
  const isRanker = state.playerId === lobby.currentRankerId;
  const hasSubmitted = lobby.submittedPlayerIds.includes(state.playerId!);

  if (isRanker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <h2 className="text-2xl font-bold">Guessing Phase</h2>
        <p className="text-gray-600">Players are trying to guess your ranking...</p>
        <p className="text-lg font-medium">
          {lobby.submittedPlayerIds.length} / {lobby.players.length - 1} submitted
        </p>
      </div>
    );
  }

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <h2 className="text-2xl font-bold">Guess Submitted!</h2>
        <p className="text-gray-600">Waiting for other players...</p>
        <p className="text-lg font-medium">
          {lobby.submittedPlayerIds.length} / {lobby.players.length - 1} submitted
        </p>
      </div>
    );
  }

  // Individual mode
  const ranker = lobby.players.find((p) => p.id === lobby.currentRankerId);

  const handleSubmit = (ranking: string[]) => {
    socket.emit('submit-guess', { ranking });
  };

  return (
    <RankingBoard
      cards={lobby.cards}
      onSubmit={handleSubmit}
      submitLabel="Lock In Guess"
      title="Guess the Ranking"
      subtitle={`How do you think ${ranker?.displayName} ranked these?`}
    />
  );
}
```

### Milestone: Ranker can drag-to-rank and submit. Guessers can drag-to-guess and submit. Waiting states show progress counters.

---

## Step 11: Server — Scoring & Reveal

Add scoring calculation and the reveal event emission.

### server/src/scoring.ts

```typescript
export function calculateScore(trueRanking: string[], guessedRanking: string[]): number {
  let score = 0;
  for (let i = 0; i < 5; i++) {
    if (trueRanking[i] === guessedRanking[i]) {
      score++;
    }
  }
  return score;
}

export function calculateAuthorshipScore(
  guesses: Record<string, string>,
  cards: { id: string; authorId: string | null }[]
): number {
  let score = 0;
  for (const card of cards) {
    const guessedAuthor = guesses[card.id];
    if (card.authorId === null && guessedAuthor === 'auto') score++;
    else if (card.authorId === guessedAuthor) score++;
  }
  return score;
}
```

### Update the phase transition for reveal — add to `gameHandlers.ts`

When the phase changes to `reveal`, compute scores and emit `reveal-results`:

```typescript
// Add this function, called when advancePhase lands on 'reveal'
function emitRevealResults(io: Server, state: ServerGameState): void {
  const trueRanking = state.rankerRanking!;
  const roundScores: Record<string, number> = {};

  if (state.settings.guessingMode === 'individual') {
    for (const [playerId, guess] of state.guesses) {
      const score = calculateScore(trueRanking, guess);
      roundScores[playerId] = score;
      state.scores.set(playerId, (state.scores.get(playerId) || 0) + score);

      // Track ranker predictability
      if (!state.rankerStats.has(state.currentRankerId!)) {
        state.rankerStats.set(state.currentRankerId!, []);
      }
      state.rankerStats.get(state.currentRankerId!)!.push(score);
    }
  } else if (state.collectiveGuess) {
    const score = calculateScore(trueRanking, state.collectiveGuess);
    // All non-ranker players get the same score
    for (const [playerId] of state.players) {
      if (playerId !== state.currentRankerId) {
        roundScores[playerId] = score;
        state.scores.set(playerId, (state.scores.get(playerId) || 0) + score);
      }
    }
    if (!state.rankerStats.has(state.currentRankerId!)) {
      state.rankerStats.set(state.currentRankerId!, []);
    }
    state.rankerStats.get(state.currentRankerId!)!.push(score);
  }

  const result: RoundResult = {
    roundNumber: state.currentRound,
    rankerId: state.currentRankerId!,
    cards: state.cards.map((c) => ({ id: c.id, text: c.text })),
    trueRanking,
    guesses: Object.fromEntries(state.guesses),
    collectiveGuess: state.collectiveGuess,
    scores: roundScores,
  };

  // Add authorship info if that feature was on
  if (state.settings.authorshipGuess && state.authorshipGuesses) {
    result.authorship = Object.fromEntries(
      state.cards.map((c) => [c.id, c.authorId])
    );
    result.authorshipGuesses = state.authorshipGuesses;
    result.authorshipScore = calculateAuthorshipScore(
      state.authorshipGuesses, state.cards
    );
  }

  // Add personal rankings if that feature was on
  if (state.settings.personalRanking && state.personalRankings.size > 0) {
    result.personalRankings = Object.fromEntries(state.personalRankings);
  }

  state.roundHistory.push(result);
  io.to(state.lobbyCode).emit('reveal-results', result);
}
```

### Milestone: When the reveal phase triggers, scores are calculated and the full round result (true ranking, all guesses, scores, optional authorship/personal data) is sent to all clients.

---

## Step 12: Client — Reveal Screen

### client/src/screens/RevealScreen.tsx

```tsx
import type { Socket } from 'socket.io-client';
import { useGame } from '../context/GameContext';

export function RevealScreen({ socket }: { socket: Socket }) {
  const { state } = useGame();
  const lobby = state.lobbyState!;
  const result = state.roundResult;
  const isHost = state.playerId === lobby.hostId;

  if (!result) return <p>Loading results...</p>;

  const ranker = lobby.players.find((p) => p.id === result.rankerId);
  const cardMap = Object.fromEntries(result.cards.map((c) => [c.id, c]));

  const handleNextRound = () => socket.emit('next-round');

  return (
    <div className="flex flex-col items-center min-h-screen p-6 gap-6">
      <h2 className="text-2xl font-bold">Round {result.roundNumber} Results</h2>
      <p className="text-gray-600">{ranker?.displayName}'s ranking revealed!</p>

      {/* True Ranking */}
      <div className="w-full max-w-sm space-y-2">
        {result.trueRanking.map((cardId, index) => {
          const card = cardMap[cardId];
          return (
            <div key={cardId} className="flex items-center gap-3 px-4 py-3 bg-white border-2 rounded-xl">
              <span className="text-xl font-bold text-blue-600 w-8 text-center">#{index + 1}</span>
              <span className="flex-1 text-lg">{card?.text}</span>
            </div>
          );
        })}
      </div>

      {/* Individual Scores */}
      {lobby.settings.guessingMode === 'individual' && (
        <div className="w-full max-w-sm">
          <h3 className="font-semibold mb-2">Scores This Round</h3>
          <ul className="space-y-1">
            {Object.entries(result.scores)
              .sort(([, a], [, b]) => b - a)
              .map(([playerId, score]) => {
                const player = lobby.players.find((p) => p.id === playerId);
                return (
                  <li key={playerId} className="flex justify-between px-4 py-2 bg-gray-50 rounded-lg">
                    <span>{player?.displayName}</span>
                    <span className="font-bold">{score}/5</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {/* Collective Score */}
      {lobby.settings.guessingMode === 'collective' && result.collectiveGuess && (
        <div className="w-full max-w-sm text-center">
          <h3 className="font-semibold mb-1">Group Score</h3>
          <p className="text-4xl font-bold text-green-600">
            {Object.values(result.scores)[0]}/5
          </p>
        </div>
      )}

      {/* Authorship Results (if enabled) */}
      {result.authorship && result.authorshipGuesses && (
        <div className="w-full max-w-sm">
          <h3 className="font-semibold mb-2">
            Authorship Guesses ({result.authorshipScore}/5 correct)
          </h3>
          <ul className="space-y-1">
            {result.cards.map((card) => {
              const trueAuthor = result.authorship![card.id];
              const guessedAuthor = result.authorshipGuesses![card.id];
              const truePlayer = trueAuthor
                ? lobby.players.find((p) => p.id === trueAuthor)?.displayName
                : 'Auto-generated';
              const guessedPlayer = guessedAuthor === 'auto'
                ? 'Auto-generated'
                : lobby.players.find((p) => p.id === guessedAuthor)?.displayName;
              const correct = (trueAuthor === null && guessedAuthor === 'auto')
                || trueAuthor === guessedAuthor;

              return (
                <li key={card.id} className={`px-4 py-2 rounded-lg ${correct ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="font-medium">"{card.text}"</p>
                  <p className="text-sm text-gray-600">
                    Guessed: {guessedPlayer} {correct ? '✓' : `✗ (was ${truePlayer})`}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Personal Rankings (if enabled) */}
      {result.personalRankings && Object.keys(result.personalRankings).length > 0 && (
        <div className="w-full max-w-sm">
          <h3 className="font-semibold mb-2">Personal Rankings Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left px-2">Rank</th>
                  <th className="text-left px-2">{ranker?.displayName} (Ranker)</th>
                  {Object.keys(result.personalRankings).map((pid) => {
                    const player = lobby.players.find((p) => p.id === pid);
                    return <th key={pid} className="text-left px-2">{player?.displayName}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 font-bold">#{i + 1}</td>
                    <td className="px-2">{cardMap[result.trueRanking[i]]?.text}</td>
                    {Object.entries(result.personalRankings!).map(([pid, ranking]) => (
                      <td key={pid} className="px-2">{cardMap[ranking[i]]?.text}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Next Round / Game Over */}
      {isHost && (
        <button onClick={handleNextRound}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl text-lg font-medium">
          {lobby.currentRound < lobby.totalRounds ? 'Next Round' : 'See Final Results'}
        </button>
      )}
      {!isHost && <p className="text-gray-500">Waiting for host to continue...</p>}
    </div>
  );
}
```

### Milestone: Full reveal screen. Shows true ranking, per-player scores, authorship results (when enabled), and personal ranking comparison table (when enabled).

---

## Step 13: Server — Game Over & Multi-Round

Add game-over logic with superlatives calculation.

```typescript
// Add to gameHandlers.ts or game.ts
function emitGameOver(io: Server, state: ServerGameState): void {
  const finalScores = Object.fromEntries(state.scores);

  // Calculate superlatives
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

  // Best guesser (highest total score)
  let bestGuesser: { playerId: string; totalScore: number } | null = null;
  for (const [playerId, score] of state.scores) {
    if (!bestGuesser || score > bestGuesser.totalScore) {
      bestGuesser = { playerId, totalScore: score };
    }
  }

  io.to(state.lobbyCode).emit('game-over', {
    finalScores,
    roundHistory: state.roundHistory,
    superlatives: { mostPredictable, leastPredictable, bestGuesser },
  });
}
```

### Milestone: Multi-round games work. Ranker rotates each round. After the final round, game over is emitted with final scores and superlatives.

---

## Step 14: Client — Game Over Screen

### client/src/screens/GameOverScreen.tsx

```tsx
import { useGame } from '../context/GameContext';

export function GameOverScreen() {
  const { state } = useGame();
  const data = state.gameOverData;
  const lobby = state.lobbyState!;

  if (!data) return <p>Loading...</p>;

  const sortedScores = Object.entries(data.finalScores as Record<string, number>)
    .sort(([, a], [, b]) => b - a);

  const getPlayerName = (id: string) =>
    lobby.players.find((p) => p.id === id)?.displayName || 'Unknown';

  return (
    <div className="flex flex-col items-center min-h-screen p-6 gap-6">
      <h2 className="text-3xl font-bold">Game Over!</h2>

      {/* Leaderboard */}
      <div className="w-full max-w-sm">
        <h3 className="font-semibold text-lg mb-3">Final Standings</h3>
        <ol className="space-y-2">
          {sortedScores.map(([playerId, score], index) => (
            <li key={playerId}
              className={`flex justify-between px-4 py-3 rounded-xl
                ${index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'}`}>
              <span>
                <span className="font-bold mr-2">#{index + 1}</span>
                {getPlayerName(playerId)}
              </span>
              <span className="font-bold">{score} pts</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Superlatives */}
      <div className="w-full max-w-sm space-y-3">
        <h3 className="font-semibold text-lg">Awards</h3>

        {data.superlatives.bestGuesser && (
          <div className="px-4 py-3 bg-blue-50 rounded-xl">
            <p className="font-medium">Best Guesser</p>
            <p className="text-blue-700">{getPlayerName(data.superlatives.bestGuesser.playerId)}</p>
          </div>
        )}

        {data.superlatives.mostPredictable && (
          <div className="px-4 py-3 bg-green-50 rounded-xl">
            <p className="font-medium">Most Predictable Ranker (Open Book)</p>
            <p className="text-green-700">
              {getPlayerName(data.superlatives.mostPredictable.playerId)}
              {' '}— avg {data.superlatives.mostPredictable.avgScore.toFixed(1)}/5 guessed correctly
            </p>
          </div>
        )}

        {data.superlatives.leastPredictable && (
          <div className="px-4 py-3 bg-purple-50 rounded-xl">
            <p className="font-medium">Least Predictable Ranker (Wild Card)</p>
            <p className="text-purple-700">
              {getPlayerName(data.superlatives.leastPredictable.playerId)}
              {' '}— avg {data.superlatives.leastPredictable.avgScore.toFixed(1)}/5 guessed correctly
            </p>
          </div>
        )}
      </div>

      {/* Play Again */}
      <button onClick={() => window.location.reload()}
        className="px-8 py-3 bg-blue-600 text-white rounded-xl text-lg font-medium">
        Play Again
      </button>
    </div>
  );
}
```

### Milestone: Complete MVP game loop. Players can play multiple rounds, see final scores, awards, and start over. The full core game works end-to-end.

---

## Step 15: Collective Guessing Mode

### Server additions (in gameHandlers.ts)

```typescript
socket.on('update-collective-guess', ({ ranking }) => {
  const state = getLobbyForSocket(socket.id);
  if (!state || state.phase !== 'guessing') return;
  if (state.settings.guessingMode !== 'collective') return;
  if (socket.id === state.currentRankerId) return;

  state.collectiveGuess = ranking;
  // Broadcast to all guessers in the lobby (except sender)
  socket.to(state.lobbyCode).emit('collective-guess-updated', { ranking });
});

socket.on('lock-collective-guess', () => {
  const state = getLobbyForSocket(socket.id);
  if (!state || state.phase !== 'guessing') return;
  if (state.settings.guessingMode !== 'collective') return;
  if (!state.collectiveGuess) return;

  advancePhase(state); // -> personal_ranking or reveal
  io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
});
```

### Client — CollectiveGuessingScreen

```tsx
import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useGame } from '../context/GameContext';
import { RankingBoard } from '../components/RankingBoard';

export function CollectiveGuessingScreen({ socket }: { socket: Socket }) {
  const { state } = useGame();
  const lobby = state.lobbyState!;
  const ranker = lobby.players.find((p) => p.id === lobby.currentRankerId);

  // Live-synced order from the server
  const [syncedOrder, setSyncedOrder] = useState<string[]>(
    lobby.collectiveGuessOrder.length > 0
      ? lobby.collectiveGuessOrder
      : lobby.cards.map((c) => c.id)
  );

  useEffect(() => {
    const handler = ({ ranking }: { ranking: string[] }) => {
      setSyncedOrder(ranking);
    };
    socket.on('collective-guess-updated', handler);
    return () => { socket.off('collective-guess-updated', handler); };
  }, [socket]);

  const handleOrderChange = (ranking: string[]) => {
    setSyncedOrder(ranking);
    socket.emit('update-collective-guess', { ranking });
  };

  const handleLockIn = () => {
    socket.emit('lock-collective-guess');
  };

  return (
    <RankingBoard
      cards={lobby.cards}
      onSubmit={handleLockIn}
      submitLabel="Lock In (Group Answer)"
      title="Guess Together"
      subtitle={`Arrange how you think ${ranker?.displayName} ranked these. Everyone sees changes live.`}
      initialOrder={syncedOrder}
      onOrderChange={handleOrderChange}
    />
  );
}
```

### Milestone: Collective mode works. All guessers see the same board, any guesser's drag updates everyone's screen, any guesser can lock in the final answer.

---

## Step 16: Authorship Guessing

### Client — AuthorshipGuessScreen

```tsx
import { useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useGame } from '../context/GameContext';

export function AuthorshipGuessScreen({ socket }: { socket: Socket }) {
  const { state } = useGame();
  const lobby = state.lobbyState!;
  const isRanker = state.playerId === lobby.currentRankerId;
  const nonRankerPlayers = lobby.players.filter((p) => p.id !== lobby.currentRankerId);

  const [guesses, setGuesses] = useState<Record<string, string>>({});

  if (!isRanker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <h2 className="text-2xl font-bold">Authorship Guess</h2>
        <p className="text-gray-600">The ranker is guessing who wrote each card...</p>
      </div>
    );
  }

  const allAssigned = lobby.cards.every((c) => guesses[c.id]);

  const handleSubmit = () => {
    socket.emit('submit-authorship-guess', { guesses });
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-6 gap-4">
      <h2 className="text-2xl font-bold">Who Wrote What?</h2>
      <p className="text-gray-600">Guess the author of each card</p>

      <div className="w-full max-w-sm space-y-4">
        {lobby.cards.map((card) => (
          <div key={card.id} className="p-4 bg-white border-2 rounded-xl space-y-2">
            <p className="font-medium text-lg">"{card.text}"</p>
            <select
              value={guesses[card.id] || ''}
              onChange={(e) => setGuesses({ ...guesses, [card.id]: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select author...</option>
              {nonRankerPlayers.map((p) => (
                <option key={p.id} value={p.id}>{p.displayName}</option>
              ))}
              <option value="auto">Auto-generated</option>
            </select>
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={!allAssigned}
        className="px-8 py-3 bg-green-600 text-white rounded-xl text-lg font-medium disabled:opacity-50">
        Submit Guesses
      </button>
    </div>
  );
}
```

### Server handler (add to gameHandlers.ts)

```typescript
socket.on('submit-authorship-guess', ({ guesses }) => {
  const state = getLobbyForSocket(socket.id);
  if (!state || state.phase !== 'authorship_guess') return;
  if (socket.id !== state.currentRankerId) return;

  state.authorshipGuesses = guesses;
  advancePhase(state); // -> authorship_reveal
  io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));

  // Authorship reveal is a display-only phase, auto-advance after a delay
  setTimeout(() => {
    advancePhase(state); // -> ranking
    io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));
  }, 8000); // 8 seconds to read the results
});
```

### Milestone: If authorship guessing is enabled, the ranker sees all 5 cards and assigns each to a player or "auto-generated". Results are revealed before ranking begins.

---

## Step 17: Personal Ranking Mode

### Client — PersonalRankingScreen

```tsx
import type { Socket } from 'socket.io-client';
import { useGame } from '../context/GameContext';
import { RankingBoard } from '../components/RankingBoard';

export function PersonalRankingScreen({ socket }: { socket: Socket }) {
  const { state } = useGame();
  const lobby = state.lobbyState!;
  const hasSubmitted = lobby.submittedPlayerIds.includes(state.playerId!);

  if (hasSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <h2 className="text-2xl font-bold">Personal Ranking Submitted!</h2>
        <p className="text-gray-600">Waiting for others...</p>
        <p className="text-lg">{lobby.submittedPlayerIds.length} / {lobby.players.length} submitted</p>
      </div>
    );
  }

  const handleSubmit = (ranking: string[]) => {
    socket.emit('submit-personal-ranking', { ranking });
  };

  return (
    <RankingBoard
      cards={lobby.cards}
      onSubmit={handleSubmit}
      submitLabel="Submit My Ranking"
      title="Your Personal Ranking"
      subtitle="Forget the ranker — how would YOU rank these?"
    />
  );
}
```

### Milestone: If personal ranking is enabled, all players (including ranker) rank by their own preference after guessing. Results appear in the comparison table on the reveal screen.

---

## Step 18: Disconnection Handling

### Server — update disconnect handler in index.ts

```typescript
io.on('connection', (socket) => {
  // ... existing handlers ...

  socket.on('disconnect', () => {
    const state = getLobbyForSocket(socket.id);
    if (!state) return;

    const player = state.players.get(socket.id);
    if (player) {
      player.connected = false;
    }

    // In lobby phase, remove the player entirely
    if (state.phase === 'lobby') {
      state.players.delete(socket.id);
      state.scores.delete(socket.id);
      socketToLobby.delete(socket.id);

      // If host left, transfer to next player
      if (state.hostId === socket.id && state.players.size > 0) {
        const newHost = state.players.values().next().value!;
        newHost.isHost = true;
        state.hostId = newHost.id;
      }

      // If lobby is empty, clean it up
      if (state.players.size === 0) {
        lobbies.delete(state.lobbyCode);
        return;
      }
    }

    // During game, mark as disconnected but keep in game
    io.to(state.lobbyCode).emit('lobby-updated', toLobbyState(state));

    // Grace period: if still disconnected after 30s, auto-submit defaults
    setTimeout(() => {
      const currentState = lobbies.get(state.lobbyCode);
      if (!currentState) return;
      const p = currentState.players.get(socket.id);
      if (!p || p.connected) return; // reconnected, no action needed

      // Auto-submit if they haven't yet in the current phase
      if (!currentState.submittedPlayerIds.has(socket.id)) {
        handleAutoSubmit(io, currentState, socket.id);
      }
    }, 30000);
  });
});

function handleAutoSubmit(io: Server, state: ServerGameState, playerId: string): void {
  if (state.phase === 'card_submission' && playerId !== state.currentRankerId) {
    // Auto-submit a placeholder card
    state.cards.push(createPlayerCard('...', playerId));
    state.submittedPlayerIds.add(playerId);
    checkPhaseAdvance(io, state);
  } else if (state.phase === 'guessing' && playerId !== state.currentRankerId) {
    // Auto-submit a random guess
    const randomOrder = state.cards.map((c) => c.id).sort(() => Math.random() - 0.5);
    state.guesses.set(playerId, randomOrder);
    state.submittedPlayerIds.add(playerId);
    checkPhaseAdvance(io, state);
  }
  // For ranker-only phases (ranking, authorship), the game stalls.
  // Other players would need to wait or the host could skip.
}
```

### Milestone: Disconnected players are marked but kept in the game. After 30 seconds, auto-submit defaults to prevent game stalling. Host role transfers if the host disconnects during lobby.

---

## Step 19: Polish & Animations

### Animated Reveal (position-by-position)

Update `RevealScreen` to reveal positions one at a time:

```tsx
import { useState, useEffect } from 'react';

// Inside RevealScreen component:
const [revealedCount, setRevealedCount] = useState(0);

useEffect(() => {
  if (revealedCount < 5) {
    const timer = setTimeout(() => setRevealedCount((c) => c + 1), 1500);
    return () => clearTimeout(timer);
  }
}, [revealedCount]);

// In the render, reveal from #5 (bottom) to #1 (top):
const revealOrder = [4, 3, 2, 1, 0]; // indices to reveal in order

{revealOrder.slice(0, revealedCount).map((rankIndex) => {
  const cardId = result.trueRanking[rankIndex];
  const card = cardMap[cardId];
  return (
    <div key={cardId}
      className="flex items-center gap-3 px-4 py-3 bg-white border-2 rounded-xl
        animate-[fadeIn_0.5s_ease-out]">
      <span className="text-xl font-bold text-blue-600 w-8 text-center">#{rankIndex + 1}</span>
      <span className="flex-1 text-lg">{card?.text}</span>
    </div>
  );
})}
```

### Tailwind animation (add to globals.css)

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Milestone: Reveal screen animates positions one at a time with 1.5s delays, building suspense from #5 to #1.

---

## Step 20: Deployment

### railway.json (add to repo root)

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "RAILPACK",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "node server/dist/index.js"
  }
}
```

### Update server to serve client build in production

Already handled in Step 2's `index.ts` — the Express server serves `client/dist/` when `NODE_ENV=production`.

### Deployment steps

```bash
# 1. Push code to GitHub
git init && git add . && git commit -m "Priorities v1"
git remote add origin https://github.com/YOUR_USER/priorities.git
git push -u origin main

# 2. On Railway:
#    - New Project -> Deploy from GitHub repo -> select "priorities"
#    - Set env var: NODE_ENV=production
#    - Settings -> Public Networking -> Generate Domain
#    - Done. Railway auto-builds and deploys.

# 3. Share the URL with friends and play!
```

### Milestone: Game is live on the internet. Friends can visit the URL, create a lobby, and play.

---

## Build Order Summary

| Step | What You Get | Testable? |
|------|-------------|-----------|
| 0-2 | Project skeleton, server runs | Server starts, health check works |
| 3-4 | Lobby system + UI | Create/join lobbies, see players, change settings |
| 5-7 | Card submission flow | Submit cards, see waiting states, auto-fill |
| 8-10 | Ranking + guessing (individual) | Full core game loop minus scoring |
| 11-12 | Scoring + reveal | **Complete MVP** — playable end-to-end |
| 13-14 | Multi-round + game over | Full game with multiple rounds and awards |
| 15 | Collective guessing | Shared board mode works |
| 16 | Authorship guessing | Ranker guesses who wrote what |
| 17 | Personal ranking | Everyone ranks by preference |
| 18 | Disconnect handling | Resilient to dropped connections |
| 19 | Animations | Dramatic reveal sequence |
| 20 | Deployment | Live on the internet |

---

## Detailed Task List

### Phase 1: Project Foundation (Steps 0-2)

- [x] **0.1** Create root `package.json` with workspaces config (`client`, `server`, `shared`)
- [x] **0.2** Create root `tsconfig.base.json` with shared compiler options
- [x] **0.3** Initialize `server/` workspace — `package.json`, `tsconfig.json`
- [x] **0.4** Install server dependencies: `express`, `socket.io`, `cors`, `uuid`
- [x] **0.5** Install server dev dependencies: `@types/express`, `@types/cors`, `@types/uuid`, `tsx`, `nodemon`
- [x] **0.6** Scaffold Vite React project in `client/` with TypeScript template
- [x] **0.7** Install client dependencies: `socket.io-client`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- [x] **0.8** Install Tailwind CSS v4 + Vite plugin, configure `globals.css` with `@import "tailwindcss"`
- [x] **0.9** Configure `vite.config.ts` with React plugin, Tailwind plugin, and dev proxy for `/socket.io` to `:3000`
- [x] **0.10** Install `concurrently` at root, add `dev` script that runs both server and client
- [x] **0.11** Initialize `shared/` workspace — `package.json`, `tsconfig.json` with `composite: true`
- [x] **0.12** Create `shared/src/types.ts` with all type definitions: `GamePhase`, `GameSettings`, `Player`, `CardPublic`, `CardFull`, `RoundResult`, `LobbyState`, `ClientEvents`, `ServerEvents`
- [x] **0.13** Verify shared types are importable from both `client/` and `server/`
- [x] **0.14** Create `server/src/index.ts` — Express app, HTTP server, Socket.IO initialization with typed events
- [x] **0.15** Configure CORS for dev (allow `:5173`) and production (disabled, same-origin)
- [x] **0.16** Set Socket.IO ping interval (25s) and timeout (20s) for keep-alive
- [x] **0.17** Add health check endpoint at `GET /api/health`
- [x] **0.18** Add production static file serving — Express serves `client/dist/` with SPA fallback
- [x] **0.19** Register placeholder `lobbyHandlers` and `gameHandlers` on socket connection
- [x] **0.20** Verify: `npm run dev` starts both processes, client loads at `:5173`, health check returns `{ status: "ok" }`

### Phase 2: Lobby System (Steps 3-4)

- [x] **3.1** Create `server/src/lobby.ts` — define `ServerGameState` interface and `lobbies` Map
- [x] **3.2** Implement `generateLobbyCode()` — 4-char alphanumeric, exclude ambiguous chars, collision check
- [x] **3.3** Implement `createLobby()` — initialize full `ServerGameState`, add host player, store in `lobbies` and `socketToLobby`
- [x] **3.4** Implement `joinLobby()` — validate code exists, game in lobby phase, not full (6 max), add player
- [x] **3.5** Implement `getLobbyForSocket()` — lookup lobby via `socketToLobby` map
- [x] **3.6** Implement `toLobbyState()` — strip server-only data (authorship, rankings) and convert Maps to arrays for client
- [x] **3.7** Create `server/src/handlers/lobbyHandlers.ts` — handle `create-lobby` event: create lobby, join socket room, emit `lobby-created` + `lobby-updated`
- [x] **3.8** Handle `join-lobby` event: validate and join, emit `lobby-joined` + `lobby-updated`, emit error on failure
- [x] **3.9** Handle `update-settings` event: host-only check, lobby-phase check, merge partial settings, broadcast `lobby-updated`
- [x] **4.1** Create `client/src/hooks/useSocket.ts` — Socket.IO connection hook with auto-reconnect, expose `socket` ref and `connected` state
- [x] **4.2** Create `client/src/context/GameContext.tsx` — define state shape (`playerId`, `displayName`, `lobbyState`, `roundResult`, `gameOverData`)
- [x] **4.3** Implement `useReducer` with actions: `SET_PLAYER`, `SET_LOBBY`, `SET_ROUND_RESULT`, `SET_GAME_OVER`, `PLAYER_SUBMITTED`, `COLLECTIVE_GUESS_UPDATED`, `RESET`
- [x] **4.4** Wire up all server event listeners in `GameProvider` `useEffect`: `lobby-created`, `lobby-joined`, `lobby-updated`, `phase-changed`, `player-submitted`, `collective-guess-updated`, `reveal-results`, `game-over`
- [x] **4.5** Create `client/src/screens/HomeScreen.tsx` — name input, "Create Lobby" button, "Join Lobby" flow with code input
- [x] **4.6** Create `client/src/screens/LobbyScreen.tsx` — display join code (large, prominent), player list with host badge, settings panel (host-only: guessing mode dropdown, authorship/personal ranking checkboxes), start button (disabled until 3+ players)
- [x] **4.7** Create `client/src/App.tsx` — root component with `useSocket`, `GameProvider`, `GameRouter` that switches on `phase`
- [x] **4.8** Add error display for `error` events from server (toast or inline message)
- [x] **4.9** Verify: open 3 browser tabs, create lobby in tab 1, join from tabs 2+3 using code, all see updated player list, host can change settings and others see changes

### Phase 3: Core Game Loop — Card Submission (Steps 5-7)

- [x] **5.1** Create `server/src/game.ts` — implement `startGame()`: shuffle player order for ranker rotation, set round count (default: player count), call `startRound()`
- [x] **5.2** Implement `startRound()`: pick ranker from rotation, reset round state (cards, rankings, guesses, submissions), set phase to `card_submission`
- [x] **5.3** Implement `advancePhase()` state machine: `card_submission` → (auto-fill + shuffle) → `authorship_guess` or `ranking` (based on settings)
- [x] **5.4** Continue `advancePhase()`: `authorship_guess` → `authorship_reveal` → `ranking` → `guessing` → `personal_ranking` or `reveal` → next round or `game_over`
- [x] **5.5** Create `server/src/cards.ts` — define `CARD_POOL` array with 50+ initial entries across categories (foods, activities, hot takes, objects, experiences)
- [x] **5.6** Implement `getAutoFillCards()` — filter out duplicates of existing card texts, shuffle pool, return `count` cards as `CardFull` with `authorId: null`
- [x] **5.7** Implement `createPlayerCard()` — create `CardFull` with UUID and author ID
- [x] **5.8** Create `server/src/handlers/gameHandlers.ts` — handle `start-game` event: host-only check, min 3 players check, call `startGame()`, broadcast `phase-changed`
- [x] **5.9** Handle `submit-card` event: phase check, not-ranker check, not-already-submitted check, create player card, add to state, broadcast `player-submitted`
- [x] **5.10** Auto-advance after card submission: check if all non-rankers have submitted, call `advancePhase()`, broadcast `phase-changed`
- [x] **7.1** Create `client/src/screens/CardSubmissionScreen.tsx` — ranker view: "You are the Ranker!" + waiting message + submission counter
- [x] **7.2** Guesser view: text input (max 100 chars), submit button, auto-focus
- [x] **7.3** Post-submission view: "Card Submitted!" + waiting message + submission counter
- [x] **7.4** Wire `CardSubmissionScreen` into `GameRouter` for `card_submission` phase
- [x] **7.5** Verify: start game with 3 players, ranker sees waiting screen, guessers see input, submit cards, phase advances automatically

### Phase 4: Core Game Loop — Ranking & Guessing (Steps 8-10)

- [x] **8.1** Handle `submit-ranking` event in `gameHandlers.ts`: ranker-only check, phase check, validate 5 card IDs, store ranking, advance phase, broadcast
- [x] **8.2** Handle `submit-guess` event: not-ranker check, phase check, not-already-submitted check, validate 5 card IDs, store guess, check all submitted → advance
- [x] **9.1** Create `client/src/components/RankingBoard.tsx` — `SortableCard` sub-component with drag handle, rank number, card text
- [x] **9.2** Configure `DndContext` with `PointerSensor` (5px activation), `TouchSensor` (150ms delay), `KeyboardSensor`
- [x] **9.3** Implement `SortableContext` with `verticalListSortingStrategy`, render ordered cards
- [x] **9.4** Implement `onDragEnd` — use `arrayMove` to reorder, update local state, call `onOrderChange` callback
- [x] **9.5** Add submit button with configurable label, call `onSubmit` with current ordered IDs
- [x] **9.6** Accept `initialOrder` and `onOrderChange` props for collective mode support
- [x] **9.7** Style cards for mobile: full width, large touch targets, visual drag feedback (opacity, shadow, border color)
- [x] **10.1** Create `client/src/screens/RankingScreen.tsx` — ranker view: `RankingBoard` with "Lock In Ranking" button; guesser view: waiting screen with ranker's name
- [x] **10.2** Create `client/src/screens/GuessingScreen.tsx` — ranker view: waiting screen with submission counter; guesser view: `RankingBoard` with "Lock In Guess" button and "How do you think [name] ranked these?" subtitle
- [x] **10.3** Add post-submission waiting state to guessing screen with counter
- [x] **10.4** Wire `RankingScreen` and `GuessingScreen` into `GameRouter`
- [x] **10.5** Verify: full loop — cards submitted → ranker sees 5 shuffled cards → ranker ranks → guessers see same 5 cards → guessers submit guesses → phase advances

### Phase 5: Scoring & Reveal (Steps 11-12)

- [x] **11.1** Create `server/src/scoring.ts` — implement `calculateScore()`: position-by-position comparison, return 0-5
- [x] **11.2** Implement `calculateAuthorshipScore()`: compare guessed author per card, count correct matches
- [x] **11.3** Implement `emitRevealResults()` in game handlers: compute scores for individual mode (per-guesser) or collective mode (shared)
- [x] **11.4** Update cumulative `scores` map and `rankerStats` map after scoring
- [x] **11.5** Build `RoundResult` object with true ranking, all guesses, scores, optional authorship/personal data
- [x] **11.6** Push result to `roundHistory`, emit `reveal-results` to lobby
- [x] **11.7** Call `emitRevealResults()` when phase transitions to `reveal`
- [x] **12.1** Create `client/src/screens/RevealScreen.tsx` — display ranker's name + round number header
- [x] **12.2** Render true ranking: numbered list of cards (#1-#5) with position styling
- [x] **12.3** Individual mode: render scores table sorted by score descending, showing `X/5` per player
- [x] **12.4** Collective mode: render single group score prominently
- [x] **12.5** "Next Round" button (host only) emitting `next-round`; non-host sees "Waiting for host..." message
- [x] **12.6** Handle `next-round` on server: call `advancePhase()` (→ next round or game_over), broadcast `phase-changed`
- [x] **12.7** Wire `RevealScreen` into `GameRouter`
- [x] **12.8** Verify: complete game round end-to-end — cards → rank → guess → reveal with correct scores. **This is the MVP milestone.**

### Phase 6: Multi-Round & Game Over (Steps 13-14)

- [x] **13.1** Implement `emitGameOver()`: compile final scores, calculate superlatives (most/least predictable ranker, best guesser)
- [x] **13.2** Call `emitGameOver()` when `advancePhase()` transitions to `game_over`
- [x] **13.3** Verify ranker rotation works across multiple rounds (each player gets a turn)
- [x] **14.1** Create `client/src/screens/GameOverScreen.tsx` — final leaderboard sorted by total points, highlight winner (#1 with gold styling)
- [x] **14.2** Render superlatives section: Best Guesser, Most Predictable Ranker (Open Book), Least Predictable Ranker (Wild Card) with average scores
- [x] **14.3** Add "Play Again" button (reloads page)
- [x] **14.4** Wire `GameOverScreen` into `GameRouter` for `game_over` phase
- [x] **14.5** Verify: play a full 3+ round game, ranker rotates, scores accumulate, game over shows correct standings and awards

### Phase 7: Collective Guessing Mode (Step 15)

- [x] **15.1** Handle `update-collective-guess` on server: validate phase + mode + role, update `collectiveGuess`, broadcast `collective-guess-updated` to other guessers
- [x] **15.2** Handle `lock-collective-guess` on server: validate, call `advancePhase()`, broadcast `phase-changed`
- [x] **15.3** Create `client/src/screens/CollectiveGuessingScreen.tsx` — initialize board from `collectiveGuessOrder` or default card order
- [x] **15.4** Wire `collective-guess-updated` socket listener to update local order state in real time
- [x] **15.5** On drag end: update local state + emit `update-collective-guess` to server
- [x] **15.6** "Lock In (Group Answer)" button emits `lock-collective-guess`
- [x] **15.7** Update `GuessingScreen` to render `CollectiveGuessingScreen` when `guessingMode === 'collective'`, show ranker waiting view as before
- [x] **15.8** Verify: set lobby to collective mode, start game, all guessers see same board, one drags → others see change, lock in submits for everyone

### Phase 8: Authorship Guessing (Step 16)

- [x] **16.1** Handle `submit-authorship-guess` on server: ranker-only check, phase check, store guesses, advance to `authorship_reveal`, broadcast
- [x] **16.2** Add timed auto-advance: `setTimeout` (8s) to advance from `authorship_reveal` → `ranking`, broadcast
- [x] **16.3** Create `client/src/screens/AuthorshipGuessScreen.tsx` — ranker view: 5 cards each with a dropdown (player names + "Auto-generated"), submit button disabled until all assigned
- [x] **16.4** Guesser view: waiting message ("The ranker is guessing who wrote each card...")
- [x] **16.5** Create `client/src/screens/AuthorshipRevealScreen.tsx` — display each card with ranker's guess vs. truth, green/red indicators, auto-advancing timer display
- [x] **16.6** Add authorship results to `RevealScreen`: section showing each card, guessed author, true author, correct/incorrect, total score
- [x] **16.7** Wire `AuthorshipGuessScreen` and `AuthorshipRevealScreen` into `GameRouter`
- [x] **16.8** Verify: enable authorship in lobby, play round, ranker guesses authors, reveal shows results, then continues to ranking

### Phase 9: Personal Ranking Mode (Step 17)

- [x] **17.1** Handle `submit-personal-ranking` on server: phase check, not-already-submitted check, store in `personalRankings`, check all players submitted → advance
- [x] **17.2** Create `client/src/screens/PersonalRankingScreen.tsx` — `RankingBoard` with "Forget the ranker — how would YOU rank these?" subtitle, post-submission waiting state
- [x] **17.3** Add personal ranking comparison to `RevealScreen`: matrix/table with rows = rank positions, columns = players, cells = card text
- [x] **17.4** Wire `PersonalRankingScreen` into `GameRouter` for `personal_ranking` phase
- [x] **17.5** Verify: enable personal ranking in lobby, play round, all players rank by preference after guessing, reveal shows comparison table

### Phase 10: Disconnection Handling (Step 18)

- [x] **18.1** On socket disconnect during `lobby` phase: remove player from `players` and `scores`, clean up `socketToLobby`
- [x] **18.2** Host disconnect in lobby: transfer host to next player, update `hostId` and `isHost` flag, broadcast `lobby-updated`
- [x] **18.3** Empty lobby cleanup: delete lobby from `lobbies` map when last player leaves
- [x] **18.4** On socket disconnect during game: set `player.connected = false`, broadcast `lobby-updated` so UI shows disconnected indicator
- [x] **18.5** Implement 30-second grace period: `setTimeout` that checks if player reconnected, if not → auto-submit
- [x] **18.6** Implement `handleAutoSubmit()`: for `card_submission` phase, submit placeholder card; for `guessing` phase, submit random ranking
- [x] **18.7** After auto-submit, check if phase should advance (all submissions in)
- [x] **18.8** Add reconnection support: on socket connect, allow re-joining lobby with same display name + code, restore player state
- [x] **18.9** Add disconnected player indicator in client UI: gray out or badge players with `connected === false`
- [x] **18.10** Verify: disconnect a player mid-game (close tab), see indicator on other players' screens, after 30s auto-submit kicks in and game continues

### Phase 11: Polish & Animations (Step 19)

- [x] **19.1** Update `RevealScreen` to use progressive reveal: `revealedCount` state starting at 0, incrementing every 1.5s
- [x] **19.2** Reveal from #5 to #1 (bottom-up) for suspense building
- [x] **19.3** Add CSS `fadeIn` keyframe animation (`opacity: 0 → 1`, `translateY(10px) → 0`)
- [x] **19.4** Show guess correctness per revealed position: green check / red X per guesser (individual) or for the group (collective)
- [x] **19.5** Show running score tally as positions are revealed
- [x] **19.6** Add a "Skip" button to instantly reveal all remaining positions
- [x] **19.7** Mobile responsiveness pass: test all screens at 375px width, ensure no horizontal scroll, touch targets 44px+, ranking board fits without scrolling during drag
- [x] **19.8** Add error boundary and user-friendly error states (connection lost overlay, reconnecting indicator)

### Phase 12: Deployment (Step 20)

- [x] **20.1** Create `railway.json` at repo root with `RAILPACK` builder, build command (`npm install && npm run build`), start command (`node server/dist/index.js`)
- [x] **20.2** Verify `npm run build` works locally: shared types compile, client builds to `client/dist/`, server compiles to `server/dist/`
- [x] **20.3** Verify `NODE_ENV=production npm start` works locally: server serves client static files, socket.io connects on same port
- [x] **20.4** Expand `CARD_POOL` to 500+ entries across categories for production quality
- [x] **20.5** Initialize git repo, commit all code
- [x] **20.6** Push to GitHub repository
- [x] **20.7** Create Railway project from GitHub repo
- [x] **20.8** Set environment variable: `NODE_ENV=production`
- [x] **20.9** Generate public domain in Railway settings (Public Networking)
- [x] **20.10** Verify: visit Railway URL, create lobby, join from another device, play full game end-to-end

---

### Task Count Summary

| Phase | Tasks | Cumulative |
|-------|-------|------------|
| 1. Project Foundation | 20 | 20 |
| 2. Lobby System | 9 | 29 |
| 3. Card Submission | 15 | 44 |
| 4. Ranking & Guessing | 15 | 59 |
| 5. Scoring & Reveal | 18 | 77 |
| 6. Multi-Round & Game Over | 5 | 82 |
| 7. Collective Guessing | 8 | 90 |
| 8. Authorship Guessing | 8 | 98 |
| 9. Personal Ranking | 5 | 103 |
| 10. Disconnection Handling | 10 | 113 |
| 11. Polish & Animations | 8 | 121 |
| 12. Deployment | 10 | **131** |

**Total: 131 tasks across 12 phases.**

MVP (playable end-to-end with individual guessing) is reached at **task 12.8** (77 tasks).
Full feature set is reached at **task 17.5** (103 tasks).
Production-ready is reached at **task 20.10** (131 tasks).
