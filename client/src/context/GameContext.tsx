import { createContext, useContext, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { LobbyState, RoundResult, GameOverData } from '../../../shared/src/types.ts';
import { useSocket } from '../hooks/useSocket.ts';

interface GameContextState {
  playerId: string | null;
  displayName: string | null;
  lobbyState: LobbyState | null;
  roundResult: RoundResult | null;
  gameOverData: GameOverData | null;
}

type GameAction =
  | { type: 'SET_PLAYER'; playerId: string; displayName: string }
  | { type: 'SET_LOBBY'; lobbyState: LobbyState }
  | { type: 'SET_ROUND_RESULT'; roundResult: RoundResult }
  | { type: 'SET_GAME_OVER'; gameOverData: GameOverData }
  | { type: 'RESET' };

const initialState: GameContextState = {
  playerId: null,
  displayName: null,
  lobbyState: null,
  roundResult: null,
  gameOverData: null,
};

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_PLAYER':
      return { ...state, playerId: action.playerId, displayName: action.displayName };
    case 'SET_LOBBY':
      return { ...state, lobbyState: action.lobbyState };
    case 'SET_ROUND_RESULT':
      return { ...state, roundResult: action.roundResult };
    case 'SET_GAME_OVER':
      return { ...state, gameOverData: action.gameOverData };
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

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on('lobby-created', (data) => {
      dispatch({ type: 'SET_PLAYER', playerId: data.playerId, displayName: state.displayName || '' });
    });

    socket.on('lobby-joined', (data) => {
      dispatch({ type: 'SET_PLAYER', playerId: data.playerId, displayName: state.displayName || '' });
    });

    socket.on('lobby-updated', (data) => {
      dispatch({ type: 'SET_LOBBY', lobbyState: data });
    });

    socket.on('phase-changed', (data) => {
      dispatch({ type: 'SET_LOBBY', lobbyState: data });
    });

    socket.on('player-submitted', (data) => {
      if (state.lobbyState) {
        dispatch({
          type: 'SET_LOBBY',
          lobbyState: { ...state.lobbyState, submittedPlayerIds: [...state.lobbyState.submittedPlayerIds, data.playerId] },
        });
      }
    });

    socket.on('collective-guess-updated', (data) => {
      if (state.lobbyState) {
        dispatch({
          type: 'SET_LOBBY',
          lobbyState: { ...state.lobbyState, collectiveGuessOrder: data.ranking },
        });
      }
    });

    socket.on('reveal-results', (data) => {
      dispatch({ type: 'SET_ROUND_RESULT', roundResult: data });
    });

    socket.on('game-over', (data) => {
      dispatch({ type: 'SET_GAME_OVER', gameOverData: data });
    });

    socket.on('error', (data) => {
      console.error('Socket error:', data.message);
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
      socket.off('error');
    };
  }, [socket, state.displayName, state.lobbyState]);

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
