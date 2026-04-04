import { Outlet, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ConnectionStatus } from './components/ConnectionStatus.tsx';
import { ToastContainer } from './components/ToastContainer.tsx';
import { GameProvider, useGame } from './context/GameContext.tsx';
import { CardSubmission } from './screens/CardSubmission.tsx';
import { RoundTransition } from './screens/RoundTransition.tsx';
import { Ranking } from './screens/Ranking.tsx';
import { CollectiveGuess } from './screens/CollectiveGuess.tsx';
import { Reveal } from './screens/Reveal.tsx';
import { GameOver } from './screens/GameOver.tsx';
import { Lobby } from './screens/Lobby.tsx';

export function GameRouter() {
  const { state } = useGame();
  const { lobbyState, gameOverData, showTurnTransition } = state;

  if (showTurnTransition && lobbyState?.phase === 'card_submission') {
    return <RoundTransition />;
  }

  if (gameOverData) {
    return <GameOver />;
  }

  if (!lobbyState) return null;

  switch (lobbyState.phase) {
    case 'lobby':
      return <Lobby />;
    case 'card_submission':
      return <CardSubmission />;
    case 'ranking':
      return <Ranking />;
    case 'guessing':
      return <CollectiveGuess />;
    case 'reveal':
      return <Reveal />;
    case 'game_over':
      return <GameOver />;
    default:
      return null;
  }
}

export function App() {
  const navigate = useNavigate();

  return (
    <ErrorBoundary>
      <GameProvider navigate={navigate}>
        <ConnectionStatus />
        <ToastContainer />
        <Outlet />
      </GameProvider>
    </ErrorBoundary>
  );
}
