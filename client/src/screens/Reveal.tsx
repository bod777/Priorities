import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';
import { GameHeader } from '../components/GameHeader.tsx';

function cardScore(trueRanking: string[], guess: string[], trueCardId: string, index: number, nearMiss: boolean): number {
  const guessedRank = guess.indexOf(trueCardId);
  const diff = guessedRank === -1 ? Infinity : Math.abs(index - guessedRank);
  return diff === 0 ? 1 : (nearMiss && diff === 1 ? 0.5 : 0);
}

export function Reveal() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, turnResult, playerId, funniestVotes } = state;
  const [revealedCount, setRevealedCount] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);

  if (!lobbyState || !turnResult || !playerId) return null;

  const totalCards = turnResult.trueRanking.length;

  useEffect(() => {
    if (revealedCount < totalCards) {
      const timer = setTimeout(() => {
        setRevealedCount((prev) => prev + 1);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [revealedCount, totalCards]);

  const handleNextRound = () => {
    if (!socket) return;
    socket.emit('next-turn');
  };

  const handleSkip = () => {
    setRevealedCount(totalCards);
  };

  const isHost = lobbyState.hostId === playerId;
  const rankerName = turnResult.playerNames[turnResult.rankerId] ?? lobbyState.players.find((p) => p.id === turnResult.rankerId)?.displayName ?? turnResult.rankerId;

  const sortedScores = Object.entries(turnResult.totalScores)
    .map(([id, score]) => ({ id, score, name: turnResult.playerNames[id] ?? lobbyState.players.find((p) => p.id === id)?.displayName ?? id }))
    .sort((a, b) => b.score - a.score);

  // Reveal rank 1 first, ending at rank 5
  const orderedTrue = turnResult.trueRanking;
  const isIndividualMode = turnResult.collectiveGuess === null && !!turnResult.individualGuesses;
  const isRankerInIndividualMode = isIndividualMode && playerId === turnResult.rankerId;
  const nearMissEnabled = lobbyState.settings.nearMissScoring;

  // Find the best-scoring guesser (for ranker's right column + compare badges)
  const bestGuesser: { id: string; name: string; guess: string[] } | null = (() => {
    if (!isIndividualMode || !turnResult.individualGuesses) return null;
    let bestId: string | null = null;
    let bestScore = -1;
    for (const [id, guess] of Object.entries(turnResult.individualGuesses)) {
      const score = turnResult.scores[id] ?? 0;
      if (score > bestScore) { bestScore = score; bestId = id; }
    }
    if (!bestId) return null;
    return {
      id: bestId,
      name: turnResult.playerNames[bestId] ?? bestId,
      guess: turnResult.individualGuesses[bestId],
    };
  })();

  const orderedGuess = isIndividualMode
    ? (isRankerInIndividualMode
        ? (bestGuesser?.guess ?? turnResult.trueRanking)
        : (turnResult.individualGuesses?.[playerId] ?? []))
    : (turnResult.collectiveGuess ?? []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <GameHeader
          title="Round Results"
          currentTurn={lobbyState.currentTurn}
          totalTurns={lobbyState.totalTurns}
          rankerOrder={lobbyState.rankerOrder}
        />
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {revealedCount < totalCards && (
            <div className="flex justify-end mb-4">
              <button
                onClick={handleSkip}
                className="text-sm text-purple-600 hover:text-purple-700 underline"
              >
                Skip Animation
              </button>
            </div>
          )}

          {/* Column headers */}
          {isRankerInIndividualMode ? (
            <div className="grid grid-cols-[2rem_1fr_2rem_1fr] gap-x-3 mb-2 px-1">
              <div />
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {rankerName}'s Ranking
              </p>
              <div />
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {bestGuesser ? `Best Guess — ${bestGuesser.name}` : 'Best Guess'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[2rem_1fr_2rem_1fr] gap-x-3 mb-2 px-1">
              <div />
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {rankerName}'s Ranking
              </p>
              <div />
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {isIndividualMode ? 'Your Guess' : 'Your Collective Guess'}
              </p>
            </div>
          )}

          {/* Rows revealed rank 1 → rank 5 */}
          <div className="space-y-2 mb-8">
            {orderedTrue.map((trueCardId, index) => {
              const rank = index + 1;
              const isRevealed = index < revealedCount;
              const trueCard = lobbyState.cards.find((c) => c.id === trueCardId);
              const guessCardId = orderedGuess[index];
              const guessCard = lobbyState.cards.find((c) => c.id === guessCardId);
              const guessedRank = orderedGuess.indexOf(trueCardId);
              const diff = guessedRank === -1 ? Infinity : Math.abs(index - guessedRank);
              const pointsEarned = diff === 0 ? 1 : (nearMissEnabled && diff === 1 ? 0.5 : 0);
              const isMatch = trueCardId === guessCardId;

              return (
                <div
                  key={index}
                  className={`transition-all duration-500 ${
                    isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
                  }`}
                >
                  {isRevealed && (
                    isRankerInIndividualMode ? (
                      <div className="grid grid-cols-[2rem_1fr_2rem_1fr] gap-x-3 items-center">
                        {/* Rank badge */}
                        <div className="flex items-center justify-center">
                          <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {rank}
                          </div>
                        </div>
                        {/* Ranker's card */}
                        <div className="border-2 border-purple-200 rounded-lg p-3 bg-purple-50">
                          <p className="text-gray-800 text-sm">{trueCard?.text}</p>
                        </div>
                        {/* Match indicator */}
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          {nearMissEnabled ? (
                            <span className={`text-xs font-bold ${pointsEarned === 1 ? 'text-green-600' : pointsEarned === 0.5 ? 'text-yellow-600' : 'text-red-400'}`}>
                              {pointsEarned === 1 ? '+1' : pointsEarned === 0.5 ? '+½' : '0'}
                            </span>
                          ) : (
                            <span className={`text-lg ${isMatch ? 'text-green-600' : 'text-red-400'}`}>{isMatch ? '✓' : '✗'}</span>
                          )}
                        </div>
                        {/* Best guesser's card */}
                        <div className={`border-2 rounded-lg p-3 ${
                          pointsEarned === 1
                            ? 'border-green-400 bg-green-50'
                            : pointsEarned === 0.5
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-red-300 bg-red-50'
                        }`}>
                          <p className="text-gray-800 text-sm">{guessCard?.text}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[2rem_1fr_2rem_1fr] gap-x-3 items-center">
                        {/* Rank badge */}
                        <div className="flex items-center justify-center">
                          <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {rank}
                          </div>
                        </div>

                        {/* Ranker's card */}
                        <div className="border-2 border-purple-200 rounded-lg p-3 bg-purple-50">
                          <p className="text-gray-800 text-sm">{trueCard?.text}</p>
                        </div>

                        {/* Match indicator */}
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          {nearMissEnabled ? (
                            <span className={`text-xs font-bold ${pointsEarned === 1 ? 'text-green-600' : pointsEarned === 0.5 ? 'text-yellow-600' : 'text-red-400'}`}>
                              {pointsEarned === 1 ? '+1' : pointsEarned === 0.5 ? '+½' : '0'}
                            </span>
                          ) : (
                            <span className={`text-lg ${isMatch ? 'text-green-600' : 'text-red-400'}`}>{isMatch ? '✓' : '✗'}</span>
                          )}
                        </div>

                        {/* Guess card */}
                        <div className={`border-2 rounded-lg p-3 ${
                          pointsEarned === 1
                            ? 'border-green-400 bg-green-50'
                            : pointsEarned === 0.5
                            ? 'border-yellow-400 bg-yellow-50'
                            : 'border-red-300 bg-red-50'
                        }`}>
                          <p className="text-gray-800 text-sm">{guessCard?.text}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>

          {/* This Turn scores (individual mode only) */}
          {isIndividualMode && revealedCount >= totalCards && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">This Turn</h2>
              <div className="space-y-2">
                {Object.entries(turnResult.scores)
                  .filter(([id]) => id !== turnResult.rankerId)
                  .sort(([, a], [, b]) => b - a)
                  .map(([id, score]) => (
                    <div key={id} className="flex justify-between px-3 py-2 bg-gray-50 rounded-lg">
                      <span className="font-medium">{turnResult.playerNames[id] ?? id}</span>
                      <span className="font-bold text-purple-600">{score} pts</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Compare Guesses (individual mode only) */}
          {isIndividualMode && revealedCount >= totalCards && turnResult.individualGuesses && (() => {
            const guessers = Object.entries(turnResult.individualGuesses)
              .filter(([id]) => id !== turnResult.rankerId && id !== playerId)
              .sort(([aId], [bId]) => {
                const aScore = turnResult.scores[aId] ?? 0;
                const bScore = turnResult.scores[bId] ?? 0;
                return bScore - aScore;
              });

            return (
              <div className="mb-6">
                <button
                  onClick={() => setCompareOpen((o) => !o)}
                  className="flex items-center justify-between w-full text-left mb-3"
                >
                  <h2 className="text-lg font-semibold">Compare Guesses</h2>
                  <span className="text-gray-400 text-sm">{compareOpen ? '▲ Hide' : '▼ Show'}</span>
                </button>

                {compareOpen && (
                  <div className="space-y-6">
                    {guessers.map(([guesserId, guess]) => {
                      const guesserName = turnResult.playerNames[guesserId] ?? guesserId;
                      const guesserScore = turnResult.scores[guesserId] ?? 0;
                      const isBest = bestGuesser?.id === guesserId;

                      return (
                        <div key={guesserId}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-gray-700">{guesserName}</span>
                            {isBest && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">⭐ Best</span>}
                            <span className="ml-auto text-sm font-bold text-purple-600">{guesserScore} pts</span>
                          </div>
                          <div className="space-y-1.5">
                            {orderedTrue.map((trueCardId, i) => {
                              const guessedCardId = guess[i];
                              const trueCard = lobbyState.cards.find((c) => c.id === trueCardId);
                              const guessedCard = lobbyState.cards.find((c) => c.id === guessedCardId);
                              const pts = cardScore(orderedTrue, guess, trueCardId, i, nearMissEnabled);
                              const cardIsMatch = trueCardId === guessedCardId;

                              return (
                                <div key={i} className="grid grid-cols-[2rem_1fr_2rem_1fr] gap-x-3 items-center">
                                  <div className="flex items-center justify-center">
                                    <div className="bg-purple-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                      {i + 1}
                                    </div>
                                  </div>
                                  <div className="border border-purple-200 rounded-lg px-3 py-2 bg-purple-50">
                                    <p className="text-gray-800 text-xs">{trueCard?.text}</p>
                                  </div>
                                  <div className="flex flex-col items-center justify-center">
                                    {nearMissEnabled ? (
                                      <span className={`text-xs font-bold ${pts === 1 ? 'text-green-600' : pts === 0.5 ? 'text-yellow-600' : 'text-red-400'}`}>
                                        {pts === 1 ? '+1' : pts === 0.5 ? '+½' : '0'}
                                      </span>
                                    ) : (
                                      <span className={`text-sm ${cardIsMatch ? 'text-green-600' : 'text-red-400'}`}>{cardIsMatch ? '✓' : '✗'}</span>
                                    )}
                                  </div>
                                  <div className={`border rounded-lg px-3 py-2 ${
                                    pts === 1 ? 'border-green-400 bg-green-50' : pts === 0.5 ? 'border-yellow-400 bg-yellow-50' : 'border-red-300 bg-red-50'
                                  }`}>
                                    <p className="text-gray-800 text-xs">{guessedCard?.text}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Scores */}
          {revealedCount >= totalCards && turnResult.authorshipResults && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-1">Authorship Guesses</h2>
              <p className="text-sm text-gray-500 mb-3">
                {rankerName} scored <span className="font-bold text-purple-600">{turnResult.authorshipScore} / {turnResult.cards.length}</span> correct
              </p>
              <div className="space-y-2">
                {turnResult.cards.map((card) => {
                  const trueAuthorId = turnResult.authorshipResults![card.id];
                  const guessedAuthorId = turnResult.authorshipGuesses?.[card.id];
                  const isCorrect = trueAuthorId === guessedAuthorId;
                  const getName = (id: string) =>
                    id === 'auto' ? 'Auto (generated)' : (turnResult.playerNames[id] ?? id);
                  const trueAuthorName = getName(trueAuthorId);
                  const guessedName = guessedAuthorId ? getName(guessedAuthorId) : '—';
                  return (
                    <div key={card.id} className={`rounded-lg p-3 border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-sm font-medium text-gray-800 mb-1">{card.text}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">Guessed:</span>
                        <span className="font-medium">{guessedName}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500">Actually:</span>
                        <span className="font-medium">{trueAuthorName}</span>
                        <span className="ml-auto text-base">{isCorrect ? '✓' : '✗'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {revealedCount >= totalCards && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Total Scores</h2>
              <div className="space-y-2">
                {sortedScores.map((entry, index) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      index === 0 ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-gray-400">#{index + 1}</span>
                      <span className="font-medium">{entry.name}</span>
                    </div>
                    <span className="text-lg font-bold text-purple-600">{entry.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {revealedCount >= totalCards && lobbyState.settings.funniestCardMode !== 'off' && (() => {
            const mode = lobbyState.settings.funniestCardMode;
            const isRanker = playerId === turnResult.rankerId;
            const result = turnResult.funniestCardId;
            const hasResult = result !== null;
            const myVote = funniestVotes[playerId];
            const hasVoted = !!myVote;
            const canVote = mode === 'ranker' ? isRanker : !hasVoted;
            const winnerName = turnResult.funniestCardWinnerId
              ? (turnResult.playerNames[turnResult.funniestCardWinnerId] ?? turnResult.funniestCardWinnerId)
              : null;
            const winningCard = hasResult ? turnResult.cards.find((c) => c.id === result) : null;
            const totalVoters = lobbyState.players.filter((p) => p.connected).length;
            const votesCast = Object.keys(funniestVotes).length;

            return (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">
                  {mode === 'ranker' ? '😂 Ranker\'s Funniest Card' : '😂 Vote for the Funniest Card'}
                </h2>

                {hasResult ? (
                  <div className="space-y-3">
                    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                      <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-1">Funniest Card</p>
                      <p className="text-gray-800 font-medium">{winningCard?.text ?? 'No winner (tie)'}</p>
                    </div>
                    {winnerName ? (
                      <p className="text-sm text-gray-600 text-center">
                        <span className="font-bold text-purple-600">{winnerName}</span> earns +1 point!
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 text-center">
                        {turnResult.funniestCardId ? 'Auto-generated card — no points awarded.' : 'It\'s a tie — no points awarded.'}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mode === 'vote' && (
                      <p className="text-sm text-gray-500">{votesCast} / {totalVoters} voted</p>
                    )}
                    {canVote ? (
                      <div className="space-y-2">
                        {mode === 'ranker' && !isRanker && (
                          <p className="text-sm text-gray-500 text-center">Waiting for {turnResult.playerNames[turnResult.rankerId]} to pick...</p>
                        )}
                        {(mode === 'vote' || isRanker) && turnResult.cards.map((card) => (
                          <button
                            key={card.id}
                            onClick={() => socket?.emit('submit-funniest-card', { cardId: card.id })}
                            className="w-full text-left border-2 border-gray-200 rounded-lg p-3 hover:border-purple-400 hover:bg-purple-50 transition font-medium text-gray-800"
                          >
                            {card.text}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center">
                        {mode === 'vote' ? `Your vote: "${turnResult.cards.find((c) => c.id === myVote)?.text}" — waiting for others...` : 'Waiting for ranker to pick...'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {revealedCount >= totalCards && (() => {
            const funniestDone = lobbyState.settings.funniestCardMode === 'off' || turnResult.funniestCardId !== null;
            return isHost ? (
              <button
                onClick={handleNextRound}
                disabled={!funniestDone}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition ${funniestDone ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
              >
                {funniestDone
                  ? (lobbyState.currentTurn < lobbyState.totalTurns ? 'Next Turn' : 'View Final Results')
                  : 'Waiting for funniest card...'}
              </button>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 text-center">Waiting for host to continue...</p>
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
