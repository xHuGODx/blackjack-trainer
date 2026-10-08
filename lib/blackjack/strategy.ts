import { DEFAULT_CONTEXT, evaluate, legalActions, value, type Action, type HandContext, type Rank, type Rules } from './model';
import type { System, Rounding } from './counting';
export type Advice = { action: Action; fallback?: Action; reason: string; conditional?: string };
const between = (n: number, lo: number, hi: number) => n >= lo && n <= hi;
// Total-dependent standard 3:2 strategy. Reference and scope: docs/mathematics.md.
export function basicStrategy(cards: readonly Rank[], dealer: Rank, rules: Rules, context: HandContext = DEFAULT_CONTEXT): Advice | null {
  if (context === DEFAULT_CONTEXT && rules.surrender === 'early') context = { ...context, peekCleared: false };
  context = { ...context, peekCleared: rules.holeCard === 'peek' ? context.peekCleared : dealer !== 'A' && value(dealer) !== 10 };
  const legal = legalActions(cards, rules, context, dealer);
  if (!legal.length) return null;
  const { total: t, soft, pair } = evaluate(cards);
  const d = dealer === 'A' ? 11 : value(dealer);
  const single = rules.decks === 1;
  const two = rules.decks === 2;
  const small = single || two;
  const p = value(cards[0]);
  const can = (a: Action) => legal.includes(a);
  const ordinary = (): Action => {
    if (soft) {
      if (t >= 19) return 'stand';
      if (t === 18) return d <= 8 || (small && !rules.h17 && d === 11) ? 'stand' : 'hit';
      return 'hit';
    }
    if (t >= 17) return 'stand';
    if (t >= 13 && d <= 6) return 'stand';
    if (t === 12 && between(d, 4, 6)) return 'stand';
    // Single-deck pair sevens have a total-dependent pair exception.
    if (single && pair && p === 7 && d === 10) return 'stand';
    return 'hit';
  };
  const fallback = ordinary();
  let split = false;
  if (pair && can('split')) {
    split = p === 1 || p === 8;
    if (p === 2) split = between(d, rules.das ? 2 : (single ? 3 : 4), 7);
    if (p === 3) split = between(d, rules.das ? 2 : 4, single ? (rules.h17 ? (rules.das ? 7 : 6) : (rules.das ? 8 : 7)) : 7);
    if (p === 4) split = rules.das && between(d, single ? 4 : 5, 6);
    if (p === 6) split = between(d, small || rules.das ? 2 : 3, small && rules.das ? 7 : 6);
    if (p === 7) split = between(d, 2, small && rules.das ? 8 : 7);
    if (p === 9) split = between(d, 2, 6) || d === 8 || d === 9 || (single && rules.h17 && d === 11 && rules.das);
    if (rules.holeCard === 'enhc') {
      if (p === 8 && d >= 10) split = false;
      if (p === 1 && d === 11) split = false;
    }
  }
  let double = false;
  if (!soft) {
    double = (t === 8 && single && between(d, 5, 6)) || (t === 9 && between(d, small ? 2 : 3, 6)) || (t === 10 && between(d, 2, 9)) || (t === 11 && (d <= 10 || small || rules.h17));
    if (pair && p === 4 && single && !rules.das && between(d, 5, 6)) double = true;
  } else {
    if (t === 12) double = d === 6 || (small && d === 5);
    if (t === 13 || t === 14) double = between(d, single && t === 14 ? 4 : 5, 6);
    if (t === 15 || t === 16) double = between(d, 4, 6);
    if (t === 17) double = between(d, 3, 6) || (single && d === 2);
    if (t === 18) double = between(d, 3, 6) || (!single && rules.h17 && d === 2);
    if (t === 19) double = (single && d === 6) || (!single && rules.h17 && d === 6);
  }
  if (rules.holeCard === 'enhc' && d >= 10) double = false;
  const result = (action: Action, conditional?: string): Advice => ({ action, fallback: action === 'double' ? fallback : action === 'split' ? (double && can('double') ? 'double' : fallback) : action === 'surrender' ? (split ? 'split' : double && can('double') ? 'double' : fallback) : undefined, conditional, reason: `${soft ? 'Soft' : 'Hard'} ${t} against dealer ${dealer}. ${action === 'split' ? 'The pair is stronger as separate hands under these rules.' : action === 'double' ? 'Take one card with a doubled stake; the selected rules permit doubling.' : action === 'surrender' ? 'Giving up half the original stake is preferred under the selected surrender rule.' : action === 'stand' ? 'Keep this total rather than take another card.' : 'Take another card to improve this total.'}` });
  if (context.afterSplit && context.splitAces) {
    if (pair && cards[0] === 'A' && can('split')) return result('split', 'Resplitting aces allowed; one card per resulting ace hand.');
    return { action: 'stand', reason: 'Split aces receive one card only; resplitting requires permission and a free hand slot.' };
  }
  if (t === 21) return { action: 'stand', reason: evaluate(cards).blackjack && !context.afterSplit ? 'Natural blackjack pays 3:2 unless the dealer also has blackjack.' : 'You have 21. Keep this hand.' };
  if (can('surrender') && rules.surrender === 'early' && !soft) {
    let early = d === 11 && (between(t, 5, 7) || between(t, 12, 17) || (pair && p === 2 && rules.h17));
    if (d === 10 && between(t, 14, 16)) {
      early = true;
      const lowCards = cards.map(value).sort((a, b) => a - b).join(',');
      if (single && ['4,10', '5,9'].includes(lowCards)) early = false;
      if (two && lowCards === '4,10') early = false;
      if (single && pair && p === 8 && rules.das) early = false;
    }
    if (early) return result('surrender', 'Early surrender, before a blackjack check.');
  }
  if (can('surrender') && !soft && (rules.surrender !== 'early' || d < 10)) {
    const late = (!pair || p !== 8) && ((t === 16 && (d === 10 || d === 11 || (!small && d === 9))) || (t === 15 && ((!single && d === 10) || (rules.h17 && d === 11))) || (t === 17 && rules.h17 && d === 11));
    const pair8 = pair && p === 8 && d === 11 && rules.h17 && (!small || (two && !rules.das));
    // Late surrender under ENHC is not risk-free against 10/A before a check.
    const pair7 = single && pair && p === 7 && (d === 10 || (rules.h17 && d === 11));
    if ((late || pair8 || pair7) && (rules.holeCard === 'peek' || context.peekCleared || d < 10 || rules.surrender === 'early')) return result('surrender', 'Surrender only when available at this stage.');
  }
  if (split) return result('split', 'Split only while a hand slot is available. DAS and resplit rules applied.');
  if (double && can('double')) return result('double', `Double if permitted, otherwise ${fallback}.`);
  if (!can(fallback)) return result('stand');
  return result(fallback, double ? `Doubling is restricted; ${fallback} instead.` : undefined);
}
export type Deviation = { total: number; dealer: number; threshold: number; high: Action; low: Action; pair?: boolean };
export const DEVIATIONS: readonly Deviation[] = [
  { total: 16, dealer: 10, threshold: 0, high: 'stand', low: 'hit' },
  { total: 15, dealer: 10, threshold: 4, high: 'stand', low: 'hit' },
  { total: 20, dealer: 5, threshold: 5, high: 'split', low: 'stand', pair: true },
  { total: 20, dealer: 6, threshold: 4, high: 'split', low: 'stand', pair: true },
  { total: 10, dealer: 10, threshold: 4, high: 'double', low: 'hit' },
  { total: 12, dealer: 3, threshold: 2, high: 'stand', low: 'hit' },
  { total: 12, dealer: 2, threshold: 3, high: 'stand', low: 'hit' },
  { total: 11, dealer: 11, threshold: 1, high: 'double', low: 'hit' },
  { total: 9, dealer: 2, threshold: 1, high: 'double', low: 'hit' },
  { total: 10, dealer: 11, threshold: 4, high: 'double', low: 'hit' },
  { total: 9, dealer: 7, threshold: 3, high: 'double', low: 'hit' },
  { total: 16, dealer: 9, threshold: 5, high: 'stand', low: 'hit' },
  { total: 13, dealer: 2, threshold: -1, high: 'stand', low: 'hit' },
  { total: 12, dealer: 4, threshold: 0, high: 'stand', low: 'hit' },
  { total: 12, dealer: 5, threshold: -2, high: 'stand', low: 'hit' },
  { total: 12, dealer: 6, threshold: -1, high: 'stand', low: 'hit' },
  { total: 13, dealer: 3, threshold: -2, high: 'stand', low: 'hit' },
];
const FAB4 = [{ total: 14, dealer: 10, threshold: 3 }, { total: 15, dealer: 10, threshold: 0 }, { total: 15, dealer: 9, threshold: 2 }, { total: 15, dealer: 11, threshold: 1 }];
export function deviationsSupported(rules: Rules, system: System, rounding: Rounding, context: HandContext = DEFAULT_CONTEXT): boolean {
  return system === 'Hi-Lo' && rounding === 'floor' && rules.decks === 6 && !rules.h17 && rules.das && rules.double === 'any' && rules.holeCard === 'peek' && rules.surrender !== 'early' && !context.afterSplit && context.peekCleared;
}
export function countDeviation(cards: readonly Rank[], dealer: Rank, rules: Rules, context: HandContext, system: System, rounding: Rounding, tc: number | null): (Advice & { threshold: number }) | null {
  if (tc === null || !deviationsSupported(rules, system, rounding, context)) return null;
  const hand = evaluate(cards);
  if (hand.soft || hand.bust || cards.length < 2) return null;
  const d = dealer === 'A' ? 11 : value(dealer);
  const legal = legalActions(cards, rules, context, dealer);
  const base = basicStrategy(cards, dealer, rules, context);
  const fab = FAB4.find(item => item.total === hand.total && item.dealer === d);
  if (fab && legal.includes('surrender') && tc >= fab.threshold) return { action: 'surrender', threshold: fab.threshold, reason: `Hi-Lo surrender index: TC ≥ ${fab.threshold}. Six-deck S17, peek, DAS.` };
  if (base?.action === 'surrender' && !fab) return null;
  const index = DEVIATIONS.find(item => item.total === hand.total && item.dealer === d && (item.pair ? hand.pair : !hand.pair));
  if (!index) return null;
  const action = tc >= index.threshold ? index.high : index.low;
  if (!legal.includes(action)) return null;
  return { action, threshold: index.threshold, reason: `Hi-Lo index ${index.threshold >= 0 ? '+' : ''}${index.threshold}: ${index.high} at or above the threshold, otherwise ${index.low}.` };
}
