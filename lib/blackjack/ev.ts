import { evaluate, legalActions, RANKS, value, type Action, type Composition, type HandContext, type Rank, type Rules } from './model';
export type EVResult = { values: Partial<Record<Action, number>>; unavailable: Partial<Record<Action, string>>; nodes: number; model: string; error?: string };
// Finite shoe, without replacement. The unknown hole card stays in the population;
// a negative peek changes both its posterior and the player's draw probabilities.
export function calculateEV(shoe: Composition, cards: readonly Rank[], upcard: Rank, rules: Rules, context: HandContext, maxNodes = 600_000, timeLimitMs = 1600): EVResult {
  const values: EVResult['values'] = {};
  const unavailable: EVResult['unavailable'] = {};
  let nodes = 0;
  const started = Date.now();
  const model = 'Exact finite-shoe EV. Hit uses optimal hit/stand continuation; double takes one card. Split EV is not calculated.';
  const legal = legalActions(cards, rules, context, upcard);
  const counts = Array<number>(10).fill(0);
  for (const rank of RANKS) counts[value(rank) - 1] += shoe[rank];
  const dealer = value(upcard);
  const exclude = rules.holeCard === 'peek' && context.peekCleared ? (dealer === 1 ? 9 : dealer === 10 ? 0 : -1) : -1;
  const reserved = rules.holeCard === 'peek';
  const dealerMemo = new Map<string, number[]>();
  const distributionMemo = new Map<string, number[]>();
  const playerMemo = new Map<string, number>();
  const totalCards = (c: number[]) => c.reduce((a, b) => a + b, 0);
  const checkpoint = () => {
    nodes++;
    if (nodes > maxNodes || ((nodes & 1023) === 0 && Date.now() - started > timeLimitMs)) throw new Error('Exact calculation exceeded the live latency limit. No estimate is substituted.');
  };
  const handTotal = (low: number, ace: boolean) => ({ total: low + (ace && low + 10 <= 21 ? 10 : 0), soft: ace && low + 10 <= 21 });
  // Distribution order: bust, 17, 18, 19, 20, 21, natural blackjack.
  const dealerDraw = (c: number[], low: number, ace: boolean): number[] => {
    const { total, soft } = handTotal(low, ace);
    if (total > 21) return [1, 0, 0, 0, 0, 0, 0];
    if (total >= 17 && !(total === 17 && soft && rules.h17)) {
      const out = Array<number>(7).fill(0); out[total - 16] = 1; return out;
    }
    const key = `${low}:${ace ? 1 : 0}:${c.join(',')}`;
    const cached = dealerMemo.get(key); if (cached) return cached;
    checkpoint();
    const n = totalCards(c);
    if (!n) throw new Error('Too few cards remain to finish the dealer hand.');
    const out = Array<number>(7).fill(0);
    for (let i = 0; i < 10; i++) {
      if (!c[i]) continue;
      const p = c[i] / n;
      c[i]--;
      const branch = dealerDraw(c, low + i + 1, ace || i === 0);
      c[i]++;
      for (let j = 0; j < 7; j++) out[j] += p * branch[j];
    }
    dealerMemo.set(key, out); return out;
  };
  const dealerDistribution = (c: number[]): number[] => {
    const key = c.join(','); const cached = distributionMemo.get(key); if (cached) return cached;
    checkpoint();
    const n = totalCards(c) - (exclude >= 0 ? c[exclude] : 0);
    if (!n) throw new Error('No possible dealer hole card remains under the selected peek result.');
    const out = Array<number>(7).fill(0);
    for (let i = 0; i < 10; i++) {
      if (!c[i] || i === exclude) continue;
      const p = c[i] / n;
      if ((dealer === 1 && i === 9) || (dealer === 10 && i === 0)) { out[6] += p; continue; }
      c[i]--;
      const branch = dealerDraw(c, dealer + i + 1, dealer === 1 || i === 0);
      c[i]++;
      for (let j = 0; j < 7; j++) out[j] += p * branch[j];
    }
    distributionMemo.set(key, out); return out;
  };
  const stand = (c: number[], low: number, ace: boolean, stake = 1, natural = false): number => {
    const { total } = handTotal(low, ace);
    if (total > 21 && (stake === 1 || rules.holeCard !== 'obo')) return -stake;
    const out = dealerDistribution(c);
    if (natural) return (1 - out[6]) * 1.5;
    if (total > 21) return -stake + (stake - 1) * out[6];
    let ev = stake * out[0] - out[6];
    if (rules.holeCard !== 'obo') ev -= (stake - 1) * out[6];
    for (let j = 1; j <= 5; j++) ev += stake * out[j] * Math.sign(total - (j + 16));
    return ev;
  };
  const draw = (c: number[], visit: (c: number[], rank: number) => number): number => {
    const n = totalCards(c);
    const allowed = n - (exclude >= 0 ? c[exclude] : 0);
    if (n <= (reserved ? 1 : 0) || (reserved && allowed <= 0)) throw new Error('Too few cards remain for a legal draw.');
    let ev = 0;
    for (let i = 0; i < 10; i++) {
      if (!c[i]) continue;
      const p = reserved ? c[i] * (allowed - (i === exclude ? 0 : 1)) / (allowed * (n - 1)) : c[i] / n;
      if (p <= 0) continue;
      c[i]--;
      ev += p * visit(c, i + 1);
      c[i]++;
    }
    return ev;
  };
  const optimal = (c: number[], low: number, ace: boolean): number => {
    const { total } = handTotal(low, ace);
    if (total > 21) return -1;
    const key = `${low}:${ace ? 1 : 0}:${c.join(',')}`;
    const cached = playerMemo.get(key); if (cached !== undefined) return cached;
    checkpoint();
    const stay = stand(c, low, ace);
    if (total === 21) return stay;
    const hit = draw(c, (next, rank) => optimal(next, low + rank, ace || rank === 1));
    const result = Math.max(stay, hit); playerMemo.set(key, result); return result;
  };
  const hand = evaluate(cards);
  if (rules.holeCard === 'peek' && !context.peekCleared && (dealer === 1 || dealer === 10)) return { values: legal.includes('surrender') ? { surrender: -.5 } : {}, unavailable: { hit: 'Wait for the dealer blackjack check.', stand: 'Wait for the dealer blackjack check.', double: 'Wait for the dealer blackjack check.' }, nodes, model };
  for (const action of [...legal].sort((a, b) => ['stand', 'double', 'surrender', 'hit', 'split'].indexOf(a) - ['stand', 'double', 'surrender', 'hit', 'split'].indexOf(b))) {
    if (action === 'split') { unavailable.split = 'Joint split-hand EV is not calculated; use the rule-dependent basic strategy.'; continue; }
    if (action === 'surrender') { values.surrender = -.5; continue; }
    try {
      const c = [...counts];
      if (action === 'stand') values.stand = stand(c, hand.low, cards.includes('A'), 1, hand.blackjack && !context.afterSplit);
      if (action === 'double') values.double = draw(c, (next, rank) => stand(next, hand.low + rank, cards.includes('A') || rank === 1, 2));
      if (action === 'hit') values.hit = draw(c, (next, rank) => optimal(next, hand.low + rank, cards.includes('A') || rank === 1));
    } catch (error) { unavailable[action] = error instanceof Error ? error.message : 'Calculation unavailable.'; }
  }
  return { values, unavailable, nodes, model };
}
