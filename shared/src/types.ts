export type GamePhase =
  | 'lobby'
  | 'card_submission'
  | 'ranking'
  | 'guessing'
  | 'reveal'
  | 'game_over';

export interface GameSettings {
  promptsEnabled: boolean;
  roundCount: number;
  multipleSubmissionsEnabled: boolean;
}

export interface Player {
  id: string;
  displayName: string;
  isHost: boolean;
  connected: boolean;
}

export interface CardPublic {
  id: string;
  text: string;
}

export interface CardFull extends CardPublic {
  authorId: string | null;
}

export interface TurnResult {
  turnNumber: number;
  rankerId: string;
  cards: CardPublic[];
  trueRanking: string[];
  collectiveGuess: string[] | null;
  scores: Record<string, number>;
  totalScores: Record<string, number>;
}

export interface LobbyState {
  lobbyCode: string;
  hostId: string;
  settings: GameSettings;
  players: Player[];
  phase: GamePhase;
  currentTurn: number;
  totalTurns: number;
  rankerOrder: string[];
  currentRankerId: string | null;
  cards: CardPublic[];
  submittedPlayerIds: string[];
  collectiveGuessOrder: string[];
  cardPool: number;
  playerCardCounts: Record<string, number>;
}

export interface Superlatives {
  mostPredictable: { playerId: string; avgScore: number } | null;
  leastPredictable: { playerId: string; avgScore: number } | null;
  bestGuesser: { playerId: string; totalScore: number } | null;
}

export interface GameOverData {
  finalScores: Record<string, number>;
  turnHistory: TurnResult[];
  superlatives: Superlatives;
}

export interface ClientEvents {
  'create-lobby': (data: { displayName: string; settings: GameSettings }) => void;
  'join-lobby': (data: { code: string; displayName: string }) => void;
  'reconnect-player': (data: { token: string; lobbyCode: string }) => void;
  'update-settings': (data: { settings: Partial<GameSettings> }) => void;
  'update-ranker-order': (data: { order: string[] }) => void;
  'start-game': () => void;
  'submit-card': (data: { text: string }) => void;
  'done-submitting': () => void;
  'submit-ranking': (data: { ranking: string[] }) => void;
  'update-collective-guess': (data: { ranking: string[] }) => void;
  'lock-collective-guess': () => void;
  'unlock-collective-guess': () => void;
  'next-turn': () => void;
  'reset-game': () => void;
}

export interface ServerEvents {
  'lobby-created': (data: { lobbyCode: string; playerId: string; reconnectToken: string }) => void;
  'lobby-joined': (data: { playerId: string; lobbyCode: string; reconnectToken: string }) => void;
  'reconnect-success': (data: LobbyState & { playerId: string; reconnectToken: string }) => void;
  'reconnect-failed': (data: { message: string }) => void;
  'lobby-updated': (data: LobbyState) => void;
  'phase-changed': (data: LobbyState) => void;
  'player-submitted': (data: { playerId: string }) => void;
  'player-unlocked': (data: { playerId: string }) => void;
  'collective-guess-updated': (data: { ranking: string[] }) => void;
  'reveal-results': (data: TurnResult) => void;
  'game-over': (data: GameOverData) => void;
  'error': (data: { message: string }) => void;
}
