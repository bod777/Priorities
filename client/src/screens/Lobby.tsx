import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import type { GameSettings, Player } from '../../../shared/src/types.ts';

function SortablePlayer({ player, index }: { player: Player; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: player.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 cursor-move hover:bg-gray-100 transition">
        <span className="text-sm font-bold text-purple-400 w-5 text-center">{index + 1}</span>
        <span className="font-medium flex-1">{player.displayName}</span>
        {player.isHost && (
          <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs">Host</span>
        )}
      </div>
    </div>
  );
}

export function Lobby() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;

  const [localSettings, setLocalSettings] = useState<GameSettings>(
    lobbyState?.settings || {
      promptsEnabled: false,
      roundCount: 1,
    }
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!lobbyState || !playerId) return null;

  const isHost = lobbyState.hostId === playerId;
  const canStart = lobbyState.players.length >= 3;

  const handleUpdateSettings = (updates: Partial<GameSettings>) => {
    if (!socket || !isHost) return;
    const newSettings = { ...localSettings, ...updates };
    setLocalSettings(newSettings);
    socket.emit('update-settings', { settings: updates });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !socket) return;

    const oldIndex = lobbyState.rankerOrder.indexOf(active.id as string);
    const newIndex = lobbyState.rankerOrder.indexOf(over.id as string);
    const newOrder = arrayMove(lobbyState.rankerOrder, oldIndex, newIndex);
    socket.emit('update-ranker-order', { order: newOrder });
  };

  const handleStartGame = () => {
    if (!socket || !isHost || !canStart) return;
    socket.emit('start-game');
  };

  // Build ordered player list from rankerOrder (may lag a frame behind for non-hosts)
  const orderedPlayers = lobbyState.rankerOrder
    .map((id) => lobbyState.players.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-purple-600">Lobby</h1>
            <div className="text-right">
              <div className="text-sm text-gray-500">Lobby Code</div>
              <div className="flex items-center gap-2 justify-end">
                <div className="text-2xl font-bold text-purple-600">{lobbyState.lobbyCode}</div>
                <button
                  onClick={() => navigator.clipboard.writeText(lobbyState.lobbyCode)}
                  className="text-gray-400 hover:text-purple-600 transition"
                  title="Copy lobby code"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-1">Ranker Order</h2>
            <p className="text-sm text-gray-500 mb-3">
              {isHost ? 'Drag to set the order players will take their turn as ranker.' : 'The order players will take their turn as ranker.'}
            </p>

            {isHost ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={lobbyState.rankerOrder} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {orderedPlayers.map((player, index) => (
                      <SortablePlayer key={player.id} player={player} index={index} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="space-y-2">
                {orderedPlayers.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                    <span className="text-sm font-bold text-purple-400 w-5 text-center">{index + 1}</span>
                    <span className="font-medium flex-1">{player.displayName}</span>
                    {player.isHost && (
                      <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs">Host</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 mb-6">
            <h2 className="text-xl font-semibold">Game Settings</h2>
            <div>
              <label className="block text-sm font-medium mb-2">
                Rounds: {lobbyState.settings.roundCount}
                <span className="text-gray-400 font-normal ml-2">
                  ({lobbyState.settings.roundCount * lobbyState.players.length} turn{lobbyState.settings.roundCount * lobbyState.players.length !== 1 ? 's' : ''})
                </span>
              </label>
              {isHost ? (
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={localSettings.roundCount}
                  onChange={(e) => handleUpdateSettings({ roundCount: parseInt(e.target.value) })}
                  className="w-full"
                />
              ) : (
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-purple-400 h-2 rounded-full"
                    style={{ width: `${((lobbyState.settings.roundCount - 1) / 4) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {!isHost && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 text-center">
                Waiting for host to start the game...
              </p>
            </div>
          )}

          {isHost && (
            <button
              onClick={handleStartGame}
              disabled={!canStart}
              className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {canStart ? 'Start Game' : 'Need at least 3 players'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
