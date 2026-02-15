interface CardProps {
  text: string;
  rank?: number;
  className?: string;
}

export function Card({ text, rank, className = '' }: CardProps) {
  return (
    <div
      className={`bg-white border-2 border-purple-300 rounded-lg p-4 shadow-md ${className}`}
    >
      <div className="flex items-start justify-between">
        {rank !== undefined && (
          <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 flex-shrink-0">
            {rank}
          </div>
        )}
        <p className="text-gray-800 flex-1">{text}</p>
      </div>
    </div>
  );
}
