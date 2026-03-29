import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { LobbyState, TurnResult, GameOverData } from '../../../shared/src/types.ts';
import { useSocket } from '../hooks/useSocket.ts';

interface GameContextState {
  playerId: string | null;
  displayName: string | null;
  lobbyState: LobbyState | null;
  turnResult: TurnResult | null;
  gameOverData: GameOverData | null;
  showTurnTransition: boolean;
}

type GameAction =
  | { type: 'SET_PLAYER'; playerId: string; displayName: string }
  | { type: 'SET_LOBBY'; lobbyState: LobbyState }
  | { type: 'SET_TURN_RESULT'; turnResult: TurnResult }
  | { type: 'SET_GAME_OVER'; gameOverData: GameOverData }
  | { type: 'RESET_TO_LOBBY'; lobbyState: LobbyState }
  | { type: 'SHOW_TURN_TRANSITION' }
  | { type: 'HIDE_TURN_TRANSITION' }
  | { type: 'RESET' };

const initialState: GameContextState = {
  playerId: null,
  displayName: null,
  lobbyState: null,
  turnResult: null,
  gameOverData: null,
  showTurnTransition: false,
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
  const { socket } = useSocket();
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!socket) {
      console.log('GameContext: socket is null, skipping event registration');
      return;
    }

    console.log('GameContext: Registering socket event listeners', socket);

    const handleLobbyCreated = (data: { lobbyCode: string; playerId: string }) => {
      console.log('Lobby created:', data);
      dispatch({
        type: 'SET_PLAYER',
        playerId: data.playerId,
        displayName: stateRef.current.displayName || ''
      });
    };

    const handleLobbyJoined = (data: { playerId: string }) => {
      console.log('Lobby joined:', data);
      dispatch({
        type: 'SET_PLAYER',
        playerId: data.playerId,
        displayName: stateRef.current.displayName || ''
      });
    };

    const handleLobbyUpdated = (data: LobbyState) => {
      console.log('Lobby updated:', data);
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
      alert(`Error: ${data.message}`);
    };

    socket.on('lobby-created', handleLobbyCreated);
    socket.on('lobby-joined', handleLobbyJoined);
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
