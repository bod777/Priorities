import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { LobbyState, TurnResult, GameOverData } from '../../../shared/src/types.ts';
import { useSocket, saveReconnectInfo, clearReconnectInfo } from '../hooks/useSocket.ts';

interface Toast {
  id: string;
  message: string;
}

interface GameContextState {
  playerId: string | null;
  displayName: string | null;
  lobbyState: LobbyState | null;
  turnResult: TurnResult | null;
  gameOverData: GameOverData | null;
  showTurnTransition: boolean;
  toasts: Toast[];
}

type GameAction =
  | { type: 'SET_PLAYER'; playerId: string; displayName: string }
  | { type: 'SET_LOBBY'; lobbyState: LobbyState }
  | { type: 'SET_TURN_RESULT'; turnResult: TurnResult }
  | { type: 'SET_GAME_OVER'; gameOverData: GameOverData }
  | { type: 'RESET_TO_LOBBY'; lobbyState: LobbyState }
  | { type: 'SHOW_TURN_TRANSITION' }
  | { type: 'HIDE_TURN_TRANSITION' }
  | { type: 'ADD_TOAST'; id: string; message: string }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'RESET' };

const initialState: GameContextState = {
  playerId: null,
  displayName: null,
  lobbyState: null,
  turnResult: null,
  gameOverData: null,
  showTurnTransition: false,
  toasts: [],
};

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_PLAYER':
      return { ...state, playerId: action.playerId, displayName: action.displayName };
    case 'SET_LOBBY':
      return { ...state, lobbyState: action.lobbyState };
    case 'SET_TURN_RESULT':
      return { ...state, turnResult: action.turnResult };
    case 'SET_GAME_OVER':
      return { ...state, gameOverData: action.gameOverData };
    case 'RESET_TO_LOBBY':
      return { ...state, lobbyState: action.lobbyState, gameOverData: null, turnResult: null };
    case 'SHOW_TURN_TRANSITION':
      return { ...state, showTurnTransition: true };
    case 'HIDE_TURN_TRANSITION':
      return { ...state, showTurnTransition: false };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, { id: action.id, message: action.message }] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const GameContext = createContext<{
  state: GameContextState;
  dispatch: React.Dispatch<GameAction>;
} | null>(null);

interface GameProviderProps {
  children: ReactNode;
  navigate: (path: string) => void;
}

export function GameProvider({ children, navigate }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { socket } = useSocket();
  const stateRef = useRef(state);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    if (!socket) return;

    console.log('GameContext: Registering socket event listeners', socket);

    const handleLobbyCreated = (data: { lobbyCode: string; playerId: string; reconnectToken: string }) => {
      console.log('Lobby created:', data);
      saveReconnectInfo(data.reconnectToken, data.lobbyCode);
      dispatch({
        type: 'SET_PLAYER',
        playerId: data.playerId,
        displayName: stateRef.current.displayName || '',
      });
      navigateRef.current(`/${data.lobbyCode}`);
    };

    const handleLobbyJoined = (data: { playerId: string; lobbyCode: string; reconnectToken: string }) => {
      console.log('Lobby joined:', data);
      saveReconnectInfo(data.reconnectToken, data.lobbyCode);
      dispatch({
        type: 'SET_PLAYER',
        playerId: data.playerId,
        displayName: stateRef.current.displayName || '',
      });
      navigateRef.current(`/${data.lobbyCode}`);
    };

    const handleReconnectSuccess = (data: LobbyState & { playerId: string; reconnectToken: string }) => {
      console.log('Reconnect success:', data);
      saveReconnectInfo(data.reconnectToken, data.lobbyCode);
      const player = data.players.find((p) => p.id === data.playerId);
      dispatch({ type: 'SET_PLAYER', playerId: data.playerId, displayName: player?.displayName || '' });
      dispatch({ type: 'SET_LOBBY', lobbyState: data });
    };

    const handleReconnectFailed = (data: { message: string }) => {
      console.warn('Reconnect failed:', data.message);
    };

    const handleLobbyUpdated = (data: LobbyState) => {
      console.log('Lobby updated:', data);
      const prev = stateRef.current.lobbyState;
      if (prev) {
        for (const player of data.players) {
          const prevPlayer = prev.players.find((p) => p.id === player.id);
          if (prevPlayer?.connected && !player.connected) {
            const id = `${player.id}-${Date.now()}`;
            dispatch({ type: 'ADD_TOAST', id, message: `${player.displayName} disconnected` });
          }
        }
      }
      if (data.phase === 'lobby' && stateRef.current.gameOverData) {
        dispatch({ type: 'RESET_TO_LOBBY', lobbyState: data });
      } else {
        dispatch({ type: 'SET_LOBBY', lobbyState: data });
      }
    };

    const handlePhaseChanged = (data: LobbyState) => {
      console.log('Phase changed:', data);

      if (data.phase === 'card_submission') {
        dispatch({ type: 'SHOW_TURN_TRANSITION' });
        setTimeout(() => {
          dispatch({ type: 'HIDE_TURN_TRANSITION' });
        }, 3000);
      }

      dispatch({ type: 'SET_LOBBY', lobbyState: data });
    };

    const handlePlayerSubmitted = (data: { playerId: string }) => {
      console.log('Player submitted:', data);
      const current = stateRef.current.lobbyState;
      if (!current || current.submittedPlayerIds.includes(data.playerId)) return;
      dispatch({ type: 'SET_LOBBY', lobbyState: { ...current, submittedPlayerIds: [...current.submittedPlayerIds, data.playerId] } });
    };

    const handlePlayerUnlocked = (data: { playerId: string }) => {
      console.log('Player unlocked:', data);
      const current = stateRef.current.lobbyState;
      if (!current) return;
      dispatch({ type: 'SET_LOBBY', lobbyState: { ...current, submittedPlayerIds: current.submittedPlayerIds.filter((id) => id !== data.playerId) } });
    };

    const handleCollectiveGuessUpdated = (data: { ranking: string[] }) => {
      console.log('Collective guess updated:', data);
      const current = stateRef.current.lobbyState;
      if (!current) return;
      dispatch({ type: 'SET_LOBBY', lobbyState: { ...current, collectiveGuessOrder: data.ranking } });
    };

    const handleRevealResults = (data: TurnResult) => {
      console.log('Reveal results:', data);
      dispatch({ type: 'SET_TURN_RESULT', turnResult: data });
    };

    const handleGameOver = (data: GameOverData) => {
      console.log('Game over:', data);
      dispatch({ type: 'SET_GAME_OVER', gameOverData: data });
    };

    const handleError = (data: { message: string }) => {
      console.error('Socket error:', data.message);
    };

    socket.on('lobby-created', handleLobbyCreated);
    socket.on('lobby-joined', handleLobbyJoined);
    socket.on('reconnect-success', handleReconnectSuccess);
    socket.on('reconnect-failed', handleReconnectFailed);
    socket.on('lobby-updated', handleLobbyUpdated);
    socket.on('phase-changed', handlePhaseChanged);
    socket.on('player-submitted', handlePlayerSubmitted);
    socket.on('player-unlocked', handlePlayerUnlocked);
    socket.on('collective-guess-updated', handleCollectiveGuessUpdated);
    socket.on('reveal-results', handleRevealResults);
    socket.on('game-over', handleGameOver);
    socket.on('error', handleError);

    return () => {
      socket.off('lobby-created', handleLobbyCreated);
      socket.off('lobby-joined', handleLobbyJoined);
      socket.off('reconnect-success', handleReconnectSuccess);
      socket.off('reconnect-failed', handleReconnectFailed);
      socket.off('lobby-updated', handleLobbyUpdated);
      socket.off('phase-changed', handlePhaseChanged);
      socket.off('player-submitted', handlePlayerSubmitted);
      socket.off('player-unlocked', handlePlayerUnlocked);
      socket.off('collective-guess-updated', handleCollectiveGuessUpdated);
      socket.off('reveal-results', handleRevealResults);
      socket.off('game-over', handleGameOver);
      socket.off('error', handleError);
    };
  }, [socket]);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
