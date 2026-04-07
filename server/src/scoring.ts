export function calculateScore(trueRanking: string[], guessedRanking: string[], nearMiss = false): number {
  let score = 0;
  for (let i = 0; i < trueRanking.length; i++) {
    const truePos = i;
    const guessPos = guessedRanking.indexOf(trueRanking[i]);
    const diff = Math.abs(truePos - guessPos);
    if (diff === 0) {
      score += 1;
    } else if (nearMiss && diff === 1) {
      score += 0.5;
    }
  }
  return score;
}
