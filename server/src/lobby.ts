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
}

export const lobbies = new Map<string, ServerGameState>();
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
  state.rankerOrder.push(socketId);
  state.scores.set(socketId, 0);
  socketToLobby.set(socketId, code);
  return state;
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
  };
}
