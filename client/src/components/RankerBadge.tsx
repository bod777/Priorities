interface RankerBadgeProps {
  rankerName: string;
  isCurrentPlayer?: boolean;
}

export function RankerBadge({ rankerName, isCurrentPlayer = false }: RankerBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
      isCurrentPlayer
        ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
        : 'bg-purple-50 border-purple-200 text-purple-700'
    }`}>
      <span className="text-xl">👑</span>
      <div>
        <p className="text-xs font-medium opacity-75">
          {isCurrentPlayer ? 'You are the Ranker' : 'Ranker'}
        </p>
        <p className="font-bold">{rankerName}</p>
      </div>
    </div>
  );
}
