import { randomUUID } from 'crypto';
import type { GameSettings, GamePhase, CardFull, Player, LobbyState } from '../../shared/src/types.js';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface ServerGameState {
  lobbyCode: string;
  hostId: string;
  settings: GameSettings;
  players: Map<string, Player>;
  phase: GamePhase;
  currentTurn: number;
  rankerOrder: string[];
  currentRankerId: string | null;
  cards: CardFull[];
  rankerRanking: string[] | null;
  collectiveGuess: string[] | null;
  scores: Map<string, number>;
  rankerStats: Map<string, number[]>;
  turnHistory: import('../../shared/src/types.js').TurnResult[];
  submittedPlayerIds: Set<string>;
  playerCardCounts: Map<string, number>;
  pendingTimers: Map<string, ReturnType<typeof setTimeout>>;
  reconnectTokens: Map<string, string>;
}

export const lobbies = new Map<string, ServerGameState>();
export const socketToLobby = new Map<string, string>();
export const tokenToLobby = new Map<string, string>();

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

export function createLobby(hostSocketId: string, displayName: string, settings: GameSettings): { state: ServerGameState; token: string } {
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
    currentTurn: 0,
    rankerOrder: [hostSocketId],
    currentRankerId: null,
    cards: [],
    rankerRanking: null,
    collectiveGuess: null,
    scores: new Map([[hostSocketId, 0]]),
    rankerStats: new Map(),
    turnHistory: [],
    submittedPlayerIds: new Set(),
    playerCardCounts: new Map(),
    pendingTimers: new Map(),
    reconnectTokens: new Map(),
  };

  const token = randomUUID();
  state.reconnectTokens.set(token, hostSocketId);
  lobbies.set(code, state);
  socketToLobby.set(hostSocketId, code);
  tokenToLobby.set(token, code);
  return { state, token };
}

export function joinLobby(code: string, socketId: string, displayName: string): { state: ServerGameState; token: string } | null {
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

  const token = randomUUID();
  state.reconnectTokens.set(token, socketId);
  state.players.set(socketId, player);
  state.rankerOrder.push(socketId);
  state.scores.set(socketId, 0);
  socketToLobby.set(socketId, code);
  tokenToLobby.set(token, code);
  return { state, token };
}

export function reconnectPlayer(token: string, newSocketId: string): { state: ServerGameState; playerId: string } | null {
  const lobbyCode = tokenToLobby.get(token);
  if (!lobbyCode) return null;
  const state = lobbies.get(lobbyCode);
  if (!state) return null;

  const oldSocketId = state.reconnectTokens.get(token);
  if (!oldSocketId) return null;
  const player = state.players.get(oldSocketId);
  if (!player) return null;

  // Cancel any pending auto-submit timer for this player
  const timer = state.pendingTimers.get(oldSocketId);
  if (timer) {
    clearTimeout(timer);
    state.pendingTimers.delete(oldSocketId);
  }

  // Swap old socket ID for new one everywhere
  player.id = newSocketId;
  player.connected = true;

  state.players.delete(oldSocketId);
  state.players.set(newSocketId, player);

  state.rankerOrder = state.rankerOrder.map((id) => (id === oldSocketId ? newSocketId : id));

  if (state.hostId === oldSocketId) state.hostId = newSocketId;
  if (state.currentRankerId === oldSocketId) state.currentRankerId = newSocketId;

  if (state.submittedPlayerIds.has(oldSocketId)) {
    state.submittedPlayerIds.delete(oldSocketId);
    state.submittedPlayerIds.add(newSocketId);
  }

  const score = state.scores.get(oldSocketId);
  if (score !== undefined) {
    state.scores.delete(oldSocketId);
    state.scores.set(newSocketId, score);
  }

  const rankerStats = state.rankerStats.get(oldSocketId);
  if (rankerStats !== undefined) {
    state.rankerStats.delete(oldSocketId);
    state.rankerStats.set(newSocketId, rankerStats);
  }

  socketToLobby.delete(oldSocketId);
  socketToLobby.set(newSocketId, lobbyCode);

  // Issue a fresh token
  state.reconnectTokens.delete(token);
  tokenToLobby.delete(token);
  const newToken = randomUUID();
  state.reconnectTokens.set(newToken, newSocketId);
  tokenToLobby.set(newToken, lobbyCode);

  return { state, playerId: newSocketId };
}

export function getLobbyForSocket(socketId: string): ServerGameState | null {
  const code = socketToLobby.get(socketId);
  if (!code) return null;
  return lobbies.get(code) ?? null;
}

export function toLobbyState(state: ServerGameState): LobbyState {
  return {
    lobbyCode: state.lobbyCode,
    hostId: state.hostId,
    settings: state.settings,
    players: Array.from(state.players.values()),
    phase: state.phase,
    currentTurn: state.currentTurn,
    totalTurns: state.settings.roundCount * state.rankerOrder.length,
    rankerOrder: state.rankerOrder,
    currentRankerId: state.currentRankerId,
    cards: state.cards.map((c) => ({ id: c.id, text: c.text })),
    submittedPlayerIds: Array.from(state.submittedPlayerIds),
    collectiveGuessOrder: state.collectiveGuess ?? [],
    cardPool: Math.max(0, (5 - (state.players.size - 1)) - state.cards.filter(c => c.authorId !== null).length),
    playerCardCounts: Object.fromEntries(state.playerCardCounts),
  };
}
