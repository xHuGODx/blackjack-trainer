import { RANKS, remaining, type Composition, type Rank } from './model';
export const SYSTEMS = {
  'Hi-Lo': [-1, 1, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1],
  'KO': [-1, 1, 1, 1, 1, 1, 1, 0, 0, -1, -1, -1, -1],
  'Hi-Opt I': [0, 0, 1, 1, 1, 1, 0, 0, 0, -1, -1, -1, -1],
  'Hi-Opt II': [0, 1, 1, 2, 2, 1, 1, 0, 0, -2, -2, -2, -2],
  'Omega II': [0, 1, 1, 2, 2, 2, 1, 0, -1, -2, -2, -2, -2],
  'Zen Count': [-1, 1, 1, 2, 2, 2, 1, 0, 0, -2, -2, -2, -2],
} as const;
export type System = keyof typeof SYSTEMS | 'Custom';
export type Rounding = 'floor' | 'truncate' | 'nearest' | 'none';
export type Estimation = 'exact' | 'half' | 'quarter' | 'whole' | 'manual';
export function tagsFor(system: System, custom: readonly number[]): readonly number[] { return system === 'Custom' ? custom : SYSTEMS[system]; }
export function balanced(tags: readonly number[]): boolean { return Math.abs(tags.reduce((a, b) => a + b, 0)) < 1e-9; }
export function count(shoe: Composition, decks: number, system: System, custom: readonly number[], rounding: Rounding, estimation: Estimation, manual: number) {
  const tags = tagsFor(system, custom);
  const offset = system === 'KO' ? 4 - 4 * decks : 0;
  const rc = RANKS.reduce((sum, rank, index) => sum + (4 * decks - shoe[rank]) * tags[index], offset);
  const cardsLeft = remaining(shoe);
  const exactDecks = cardsLeft / 52;
  const step = estimation === 'half' ? .5 : estimation === 'quarter' ? .25 : 1;
  const estimatedDecks = estimation === 'manual' ? manual : estimation === 'exact' ? exactDecks : Math.max(step, Math.round(exactDecks / step) * step);
  const rawTC = balanced(tags) && cardsLeft > 0 && estimatedDecks > 0 ? rc / estimatedDecks : null;
  const tc = rawTC === null ? null : rounding === 'floor' ? Math.floor(rawTC) : rounding === 'truncate' ? Math.trunc(rawTC) : rounding === 'nearest' ? Math.round(rawTC) : rawTC;
  return { rc, tc: tc === 0 ? 0 : tc, rawTC, exactDecks, estimatedDecks, cardsLeft, seen: 52 * decks - cardsLeft, penetration: (1 - cardsLeft / (52 * decks)) * 100, isBalanced: balanced(tags), acesSeen: 4 * decks - shoe.A, acesLeft: shoe.A };
}
export function insurance(shoe: Composition) {
  const total = remaining(shoe);
  if (!total) return null;
  const tens = shoe['10'] + shoe.J + shoe.Q + shoe.K;
  const probability = tens / total;
  return { probability, ev: 3 * probability - 1, take: 3 * tens > total, neutral: 3 * tens === total };
}
export function betUnits(tc: number | null, spread: readonly number[]): number | null {
  if (tc === null || !Number.isFinite(tc)) return null;
  return spread[Math.min(spread.length - 1, Math.max(0, Math.floor(tc)))];
}
export function cardTag(rank: Rank, system: System, custom: readonly number[]): number { return tagsFor(system, custom)[RANKS.indexOf(rank)]; }
