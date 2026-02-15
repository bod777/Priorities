import { useSocket } from '../hooks/useSocket.ts';

export function ConnectionStatus() {
  const { connected } = useSocket();

  if (connected) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 text-center text-sm z-50">
      <div className="flex items-center justify-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        <span>Connection lost. Reconnecting...</span>
      </div>
    </div>
  );
}
