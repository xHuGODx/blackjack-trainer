export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = typeof RANKS[number];
export type Composition = Record<Rank, number>;
export type Action = 'hit' | 'stand' | 'double' | 'split' | 'surrender';
export type Rules = {
  decks: number;
  h17: boolean;
  das: boolean;
  double: 'any' | '9-11' | '10-11';
  maxHands: number;
  resplitAces: boolean;
  surrender: 'none' | 'late' | 'early';
  holeCard: 'peek' | 'enhc' | 'obo';
  penetration: number;
};
export const DEFAULT_RULES: Rules = { decks: 6, h17: false, das: true, double: 'any', maxHands: 4, resplitAces: false, surrender: 'late', holeCard: 'peek', penetration: 75 };
export type HandContext = { afterSplit: boolean; splitAces: boolean; hands: number; peekCleared: boolean };
export const DEFAULT_CONTEXT: HandContext = { afterSplit: false, splitAces: false, hands: 1, peekCleared: true };
export function value(rank: Rank): number { return rank === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(rank) ? 10 : Number(rank); }
export function freshShoe(decks: number): Composition {
  if (!Number.isInteger(decks) || decks < 1 || decks > 32) throw new Error('Choose 1–32 whole decks.');
  return Object.fromEntries(RANKS.map(rank => [rank, decks * 4])) as Composition;
}
export function removeCards(shoe: Composition, cards: readonly Rank[]): Composition {
  const next = { ...shoe };
  for (const rank of cards) {
    if (!RANKS.includes(rank) || next[rank] <= 0) throw new Error(`No ${rank} cards left in this shoe.`);
    next[rank]--;
  }
  return next;
}
export function remaining(shoe: Composition): number { return RANKS.reduce((sum, rank) => sum + shoe[rank], 0); }
export function evaluate(cards: readonly Rank[]) {
  const low = cards.reduce((sum, rank) => sum + value(rank), 0);
  const soft = cards.includes('A') && low + 10 <= 21;
  const total = low + (soft ? 10 : 0);
  return { low, total, soft, bust: total > 21, blackjack: cards.length === 2 && total === 21, pair: cards.length === 2 && value(cards[0]) === value(cards[1]) };
}
export function legalActions(cards: readonly Rank[], rules: Rules, context: HandContext = DEFAULT_CONTEXT, dealer?: Rank): Action[] {
  const hand = evaluate(cards);
  if (cards.length < 2 || hand.bust) return [];
  if (hand.total === 21) return ['stand'];
  const actions: Action[] = ['stand'];
  const restrictedAces = context.afterSplit && context.splitAces;
  if (!restrictedAces) {
    actions.push('hit');
    if (cards.length === 2 && (!context.afterSplit || rules.das) && (rules.double === 'any' || (!hand.soft && hand.total >= (rules.double === '9-11' ? 9 : 10) && hand.total <= 11))) actions.push('double');
  }
  if (hand.pair && context.hands < rules.maxHands && (!context.afterSplit || cards[0] !== 'A' || rules.resplitAces)) actions.push('split');
  const canLate = rules.surrender === 'late' && context.peekCleared;
  const canEarly = rules.surrender === 'early' && (!dealer || (dealer !== 'A' && value(dealer) < 10) || !context.peekCleared);
  if (cards.length === 2 && !context.afterSplit && (canEarly || canLate)) actions.push('surrender');
  return actions;
}
export function parseCards(text: string): Rank[] {
  const normalized = text.trim().toUpperCase().replace(/[♠♥♦♣]/g, '');
  if (!normalized) throw new Error('Enter cards, for example: A 5 10 K.');
  const tokens = normalized.split(/[\s,;]+/);
  return tokens.flatMap(token => {
    const match = /^(10|[A2-9JQKT])(?:[X*](\d+))?$/.exec(token);
    if (!match) throw new Error(`Invalid card: ${token}. Use A, 2–10, J, Q or K.`);
    const qty = Number(match[2] ?? 1);
    if (!Number.isInteger(qty) || qty < 1 || qty > 1664) throw new Error('Card quantity must be between 1 and 1664.');
    return Array<Rank>(qty).fill((match[1] === 'T' ? '10' : match[1]) as Rank);
  });
}
