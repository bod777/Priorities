import { randomUUID } from 'crypto';
import type { CardFull } from '../../shared/src/types.js';
import { CARD_POOL } from './cardPool.js';

function toTitleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function getAutoFillCards(count: number, existingTexts: string[]): CardFull[] {
  const avoid = new Set(existingTexts.map((t) => t.toLowerCase()));
  const available = CARD_POOL.filter((c) => !avoid.has(c.toLowerCase()));
  const shuffled = available.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((text) => ({
    id: randomUUID(),
    text: toTitleCase(text),
    authorId: null,
  }));
}

export function createPlayerCard(text: string, authorId: string): CardFull {
  return {
    id: randomUUID(),
    text,
    authorId,
  };
}
