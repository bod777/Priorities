export function calculateScore(trueRanking: string[], guessedRanking: string[]): number {
  let score = 0;
  for (let i = 0; i < 5; i++) {
    if (trueRanking[i] === guessedRanking[i]) {
      score++;
    }
  }
  return score;
}
