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

interface SortableCardProps {
  card: CardPublic;
  rank: number;
}

function SortableCard({ card, rank }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none select-none">
      <div className="bg-white border-2 border-purple-300 rounded-lg p-4 shadow-md cursor-move hover:border-purple-500 transition mb-3">
        <div className="flex items-start">
          <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">
            {rank}
          </div>
          <p className="text-gray-800 flex-1">{card.text}</p>
        </div>
      </div>
    </div>
  );
}

interface RankingBoardProps {
  cards: CardPublic[];
  ranking: string[];
  onRankingChange: (newRanking: string[]) => void;
  disabled?: boolean;
}

export function RankingBoard({ cards, ranking, onRankingChange, disabled = false }: RankingBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = ranking.indexOf(active.id as string);
      const newIndex = ranking.indexOf(over.id as string);
      onRankingChange(arrayMove(ranking, oldIndex, newIndex));
    }
  };

  const rankedCards = ranking
    .map((id) => cards.find((c) => c.id === id))
    .filter((c): c is CardPublic => c !== undefined);

  if (disabled) {
    return (
      <div className="space-y-3">
        {rankedCards.map((card, index) => (
          <div
            key={card.id}
            className="bg-white border-2 border-purple-300 rounded-lg p-4 shadow-md"
          >
            <div className="flex items-start">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">
                {index + 1}
              </div>
              <p className="text-gray-800 flex-1">{card.text}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ranking} strategy={verticalListSortingStrategy}>
        <div>
          {rankedCards.map((card, index) => (
            <SortableCard key={card.id} card={card} rank={index + 1} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
