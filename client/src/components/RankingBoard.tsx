import { useRef, useLayoutEffect, useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CardPublic } from '../../../shared/src/types.ts';

// A single card row that flashes when it moves remotely
function AnimatedCard({
  card,
  rank,
  movement,
  draggable,
  dragProps,
}: {
  card: CardPublic;
  rank: number;
  movement: number;
  draggable: boolean;
  dragProps?: ReturnType<typeof useSortable>;
}) {
  const [flash, setFlash] = useState(false);
  const prevMovementKey = useRef<number>(0);

  useEffect(() => {
    if (movement === 0) return;
    // Use a counter key so the same direction twice in a row still re-triggers
    prevMovementKey.current += 1;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rank]); // rank is the ground truth — it changes iff the card actually moved

  const style = dragProps
    ? { transform: CSS.Transform.toString(dragProps.transform), transition: dragProps.transition, opacity: dragProps.isDragging ? 0.5 : 1 }
    : {};

  const outer = dragProps
    ? { ref: dragProps.setNodeRef, ...dragProps.attributes, ...dragProps.listeners, className: 'touch-none select-none' }
    : {};

  return (
    <div {...outer} style={style}>
      <div className={`border-2 rounded-lg p-4 shadow-md mb-3 transition-colors duration-500 ${
        draggable ? 'cursor-move' : ''
      } ${
        flash
          ? movement < 0
            ? 'bg-green-50 border-green-400'
            : 'bg-orange-50 border-orange-400'
          : draggable
            ? 'bg-white border-purple-300 hover:border-purple-500'
            : 'bg-white border-purple-300'
      }`}>
        <div className="flex items-start">
          <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">
            {rank}
          </div>
          <p className="text-gray-800 flex-1">{card.text}</p>
          {flash && (
            <span className={`ml-2 text-lg font-bold flex-shrink-0 ${movement < 0 ? 'text-green-500' : 'text-orange-500'}`}>
              {movement < 0 ? '↑' : '↓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableAnimatedCard({ card, rank, movement }: { card: CardPublic; rank: number; movement: number }) {
  const dragProps = useSortable({ id: card.id });
  return <AnimatedCard card={card} rank={rank} movement={movement} draggable dragProps={dragProps} />;
}

interface RankingBoardProps {
  cards: CardPublic[];
  ranking: string[];
  onRankingChange: (newRanking: string[]) => void;
  disabled?: boolean;
}

export function RankingBoard({ cards, ranking, onRankingChange, disabled = false }: RankingBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const rankedCards = ranking
    .map((id) => cards.find((c) => c.id === id))
    .filter((c): c is CardPublic => c !== undefined);

  // Track each card's previous rank to detect remote moves.
  // localDrag ref suppresses the flash for the user who dragged.
  const prevRanks = useRef<Map<string, number>>(new Map());
  const localDrag = useRef(false);

  const movements = new Map<string, number>();
  if (!localDrag.current) {
    rankedCards.forEach((card, index) => {
      const prev = prevRanks.current.get(card.id);
      movements.set(card.id, prev !== undefined ? index - prev : 0);
    });
  }

  useLayoutEffect(() => {
    rankedCards.forEach((card, index) => prevRanks.current.set(card.id, index));
    localDrag.current = false;
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      localDrag.current = true;
      const oldIndex = ranking.indexOf(active.id as string);
      const newIndex = ranking.indexOf(over.id as string);
      onRankingChange(arrayMove(ranking, oldIndex, newIndex));
    }
  };

  if (disabled) {
    return (
      <div>
        {rankedCards.map((card, index) => (
          <AnimatedCard
            key={card.id}
            card={card}
            rank={index + 1}
            movement={movements.get(card.id) ?? 0}
            draggable={false}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ranking} strategy={verticalListSortingStrategy}>
        <div>
          {rankedCards.map((card, index) => (
            <SortableAnimatedCard
              key={card.id}
              card={card}
              rank={index + 1}
              movement={movements.get(card.id) ?? 0}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
