export function calculateScore(trueRanking: string[], guessedRanking: string[]): number {
  let score = 0;
  for (let i = 0; i < 5; i++) {
    if (trueRanking[i] === guessedRanking[i]) {
      score++;
    }
  }
  return score;
}

export function calculateAuthorshipScore(
  guesses: Record<string, string>,
  cards: { id: string; authorId: string | null }[]
): number {
  let score = 0;
  for (const card of cards) {
    const guessedAuthor = guesses[card.id];
    if (card.authorId === null && guessedAuthor === 'auto') score++;
    else if (card.authorId === guessedAuthor) score++;
  }
  return score;
}
