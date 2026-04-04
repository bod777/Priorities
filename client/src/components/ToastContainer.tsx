import { useEffect } from 'react';
import { useGame } from '../context/GameContext.tsx';

function Toast({ id, message }: { id: string; message: string }) {
  const { dispatch } = useGame();

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', id });
    }, 4000);
    return () => clearTimeout(timer);
  }, [id, dispatch]);

  return (
    <div className="flex items-center justify-between gap-3 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg min-w-64 max-w-sm">
      <span className="text-sm font-medium">⚠ {message}</span>
      <button
        onClick={() => dispatch({ type: 'REMOVE_TOAST', id })}
        className="text-gray-400 hover:text-white text-lg leading-none flex-shrink-0"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { state } = useGame();
  const { toasts } = state;

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast id={toast.id} message={toast.message} />
        </div>
      ))}
    </div>
  );
}
