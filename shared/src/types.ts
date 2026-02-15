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

export interface GameSettings {
  guessingMode: 'collective' | 'individual';
  authorshipGuess: boolean;
  personalRanking: boolean;
  promptsEnabled: boolean;
  roundCount: number;
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

export interface RoundResult {
  roundNumber: number;
  rankerId: string;
  cards: CardPublic[];
  trueRanking: string[];
  guesses: Record<string, string[]>;
  collectiveGuess: string[] | null;
  scores: Record<string, number>;
  authorship?: Record<string, string | null>;
  authorshipGuesses?: Record<string, string>;
  authorshipScore?: number;
  personalRankings?: Record<string, string[]>;
}

export interface LobbyState {
  lobbyCode: string;
  hostId: string;
  settings: GameSettings;
  players: Player[];
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  currentRankerId: string | null;
  cards: CardPublic[];
  submittedPlayerIds: string[];
  collectiveGuessOrder: string[];
}

export interface Superlatives {
  mostPredictable: { playerId: string; avgScore: number } | null;
  leastPredictable: { playerId: string; avgScore: number } | null;
  bestGuesser: { playerId: string; totalScore: number } | null;
}

export interface GameOverData {
  finalScores: Record<string, number>;
  roundHistory: RoundResult[];
  superlatives: Superlatives;
}

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

export interface ServerEvents {
  'lobby-created': (data: { lobbyCode: string; playerId: string }) => void;
  'lobby-joined': (data: { playerId: string }) => void;
  'lobby-updated': (data: LobbyState) => void;
  'phase-changed': (data: LobbyState) => void;
  'player-submitted': (data: { playerId: string }) => void;
  'collective-guess-updated': (data: { ranking: string[] }) => void;
  'reveal-results': (data: RoundResult) => void;
  'game-over': (data: GameOverData) => void;
  'error': (data: { message: string }) => void;
}
