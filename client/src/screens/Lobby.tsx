import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
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
import type { GameSettings, Player, FunniestCardMode } from '../../../shared/src/types.ts';

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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none select-none">
      <div className={`flex items-center gap-3 rounded-lg p-3 cursor-move transition ${player.connected ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-100 opacity-50'}`}>
        <span className="text-sm font-bold text-purple-400 w-5 text-center">{index + 1}</span>
        <span className={`font-medium flex-1 ${!player.connected ? 'text-gray-400' : ''}`}>{player.displayName}</span>
        {!player.connected && (
          <span className="bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full text-xs">disconnected</span>
        )}
        {player.isHost && player.connected && (
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
      roundCount: 1,
      multipleSubmissionsEnabled: false,
      authorshipEnabled: false,
      individualGuessEnabled: false,
      funniestCardMode: 'off',
      nearMissScoring: false,
      showSubmittedCards: false,
    }
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
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
                  <div key={player.id} className={`flex items-center gap-3 rounded-lg p-3 ${player.connected ? 'bg-gray-50' : 'bg-gray-100 opacity-50'}`}>
                    <span className="text-sm font-bold text-purple-400 w-5 text-center">{index + 1}</span>
                    <span className={`font-medium flex-1 ${!player.connected ? 'text-gray-400' : ''}`}>{player.displayName}</span>
                    {!player.connected && (
                      <span className="bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full text-xs">disconnected</span>
                    )}
                    {player.isHost && player.connected && (
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Multiple card submissions</p>
                <p className="text-xs text-gray-400">Guessers can submit more than one card to fill the pool</p>
              </div>
              {isHost ? (
                <button
                  onClick={() => handleUpdateSettings({ multipleSubmissionsEnabled: !localSettings.multipleSubmissionsEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.multipleSubmissionsEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.multipleSubmissionsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <span className={`text-sm font-medium ${lobbyState.settings.multipleSubmissionsEnabled ? 'text-purple-600' : 'text-gray-400'}`}>
                  {lobbyState.settings.multipleSubmissionsEnabled ? 'On' : 'Off'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Guess authorship</p>
                <p className="text-xs text-gray-400">Ranker guesses who submitted each card — correct guesses score points</p>
              </div>
              {isHost ? (
                <button
                  onClick={() => handleUpdateSettings({ authorshipEnabled: !localSettings.authorshipEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.authorshipEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.authorshipEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <span className={`text-sm font-medium ${lobbyState.settings.authorshipEnabled ? 'text-purple-600' : 'text-gray-400'}`}>
                  {lobbyState.settings.authorshipEnabled ? 'On' : 'Off'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Individual guessing</p>
                <p className="text-xs text-gray-400">Each player ranks independently — no shared board</p>
              </div>
              {isHost ? (
                <button
                  onClick={() => handleUpdateSettings({ individualGuessEnabled: !localSettings.individualGuessEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.individualGuessEnabled ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.individualGuessEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <span className={`text-sm font-medium ${lobbyState.settings.individualGuessEnabled ? 'text-purple-600' : 'text-gray-400'}`}>
                  {lobbyState.settings.individualGuessEnabled ? 'On' : 'Off'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium">Near Miss Scoring</p>
                  <div className="relative group">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs cursor-default select-none">?</span>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 hidden group-hover:block z-10 shadow-xl">
                      <p className="font-semibold mb-1">Near Miss Scoring</p>
                      <p className="text-gray-300 mb-2">Cards ranked exactly right score 1 pt. Cards ranked just one position off score 0.5 pts. Everything else scores 0.</p>
                      <p className="text-gray-400 italic">Example: if the answer is 3rd and you guess 2nd or 4th, you get half a point.</p>
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400">Half a point for being one position off</p>
              </div>
              {isHost ? (
                <button
                  onClick={() => handleUpdateSettings({ nearMissScoring: !localSettings.nearMissScoring })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${localSettings.nearMissScoring ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.nearMissScoring ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <span className={`text-sm font-medium ${lobbyState.settings.nearMissScoring ? 'text-purple-600' : 'text-gray-400'}`}>
                  {lobbyState.settings.nearMissScoring ? 'On' : 'Off'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Show submitted cards</p>
                <p className="text-xs text-gray-400">Guessers can see each other's cards as they are submitted</p>
              </div>
              {isHost ? (
                <button
                  onClick={() => handleUpdateSettings({ showSubmittedCards: !localSettings.showSubmittedCards })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localSettings.showSubmittedCards ? 'bg-purple-600' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.showSubmittedCards ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              ) : (
                <span className={`text-sm font-medium ${lobbyState.settings.showSubmittedCards ? 'text-purple-600' : 'text-gray-400'}`}>
                  {lobbyState.settings.showSubmittedCards ? 'On' : 'Off'}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Funniest card</p>
                <p className="text-xs text-gray-400">Award a bonus point for the funniest card each turn</p>
              </div>
              {isHost ? (
                <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                  {(['off', 'ranker', 'vote'] as FunniestCardMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleUpdateSettings({ funniestCardMode: mode })}
                      className={`px-3 py-1 font-medium transition-colors ${
                        localSettings.funniestCardMode === mode
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {mode === 'off' ? 'Off' : mode === 'ranker' ? 'Ranker picks' : 'Vote'}
                    </button>
                  ))}
                </div>
              ) : (
                <span className={`text-sm font-medium ${lobbyState.settings.funniestCardMode !== 'off' ? 'text-purple-600' : 'text-gray-400'}`}>
                  {lobbyState.settings.funniestCardMode === 'off' ? 'Off' : lobbyState.settings.funniestCardMode === 'ranker' ? 'Ranker picks' : 'Vote'}
                </span>
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
