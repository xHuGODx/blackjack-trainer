import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEV } from '../lib/blackjack/ev';
import { DEFAULT_CONTEXT, DEFAULT_RULES, freshShoe, removeCards, RANKS, type Rank, type Composition } from '../lib/blackjack/model';
const near = (actual: number | undefined, expected: number, tolerance = .0000006) => { assert.notEqual(actual, undefined); assert.ok(Math.abs(actual! - expected) < tolerance, `${actual} ≠ ${expected}`); };
test('finite EV golden values: 16 vs 10, negative peek', () => {
  const result = calculateEV(removeCards(freshShoe(6), ['10', '6', '10']), ['10', '6'], '10', DEFAULT_RULES, DEFAULT_CONTEXT);
  near(result.values.stand, -.540954); near(result.values.hit, -.534676); near(result.values.double, -1.069351); near(result.values.surrender, -.5);
});
test('finite EV golden values: 11 vs 6', () => {
  const result = calculateEV(removeCards(freshShoe(6), ['5', '6', '6']), ['5', '6'], '6', DEFAULT_RULES, DEFAULT_CONTEXT);
  near(result.values.stand, -.150826); near(result.values.hit, .341332); near(result.values.double, .682665);
});
test('finite EV golden values: 16 vs A excludes ten-value hole cards', () => {
  const result = calculateEV(removeCards(freshShoe(6), ['10', '6', 'A']), ['10', '6'], 'A', DEFAULT_RULES, DEFAULT_CONTEXT);
  near(result.values.stand, -.664825); near(result.values.hit, -.515800); near(result.values.double, -1.031600);
});
test('natural pays 3:2; split 21 pays 1:1; no invented split EV', () => {
  const shoe = removeCards(freshShoe(6), ['A', '10', '6']);
  near(calculateEV(shoe, ['A', '10'], '6', DEFAULT_RULES, DEFAULT_CONTEXT).values.stand, 1.5);
  assert.ok(calculateEV(shoe, ['A', '10'], '6', DEFAULT_RULES, { ...DEFAULT_CONTEXT, afterSplit: true, hands: 2 }).values.stand! < 1);
  const pair = calculateEV(removeCards(freshShoe(6), ['8', '8', '6']), ['8', '8'], '6', DEFAULT_RULES, DEFAULT_CONTEXT);
  assert.equal(pair.values.split, undefined); assert.ok(pair.unavailable.split);
});
function tinyShoe(cards: Rank[]): Composition {
  const shoe = Object.fromEntries(RANKS.map(rank => [rank, 0])) as Composition;
  for (const card of cards) shoe[card]++;
  return shoe;
}
// An independent enumerator uses every physical-card permutation, not engine DP.
function permutations(cards: number[]): number[][] {
  if (!cards.length) return [[]];
  return cards.flatMap((card, i) => permutations(cards.filter((_, j) => i !== j)).map(rest => [card, ...rest]));
}
function score(cards: number[]) {
  const low = cards.reduce((a, b) => a + b, 0); const soft = cards.includes(1) && low <= 11;
  return { total: low + (soft ? 10 : 0), soft };
}
function bruteDouble(rule: 'peek' | 'enhc' | 'obo') {
  let sum = 0, outcomes = 0;
  for (const sequence of permutations([1, 5, 6, 10, 10, 10])) {
    const rest = [...sequence];
    let hole: number;
    let draw: number;
    if (rule === 'peek') { hole = rest.shift()!; if (hole === 1) continue; draw = rest.shift()!; }
    else { draw = rest.shift()!; hole = rest.shift()!; }
    outcomes++;
    if (hole === 1) { sum += rule === 'obo' ? -1 : -2; continue; }
    const dealer = [10, hole];
    while (score(dealer).total < 17) { assert.ok(rest.length > 0); dealer.push(rest.shift()!); }
    const player = 11 + draw;
    sum += player > 21 ? -2 : score(dealer).total > 21 ? 2 : 2 * Math.sign(player - score(dealer).total);
  }
  return sum / outcomes;
}
test('exact doubles agree with exhaustive physical-card permutations: peek, ENHC, OBO', () => {
  const shoe = tinyShoe(['A', '5', '6', '10', '10', '10']);
  for (const holeCard of ['peek', 'enhc', 'obo'] as const) {
    const result = calculateEV(shoe, ['5', '6'], '10', { ...DEFAULT_RULES, holeCard }, { ...DEFAULT_CONTEXT, peekCleared: holeCard === 'peek' });
    near(result.values.double, bruteDouble(holeCard), 1e-12);
  }
});
test('H17 dealer rule affects soft 17 outcomes', () => {
  const shoe = tinyShoe(['6', '2', '10', '10', '10', '10']);
  const rules = { ...DEFAULT_RULES, holeCard: 'enhc' as const, surrender: 'none' as const };
  const context = { ...DEFAULT_CONTEXT, peekCleared: false };
  const s17 = calculateEV(shoe, ['10', '8'], 'A', rules, context);
  const h17 = calculateEV(shoe, ['10', '8'], 'A', { ...rules, h17: true }, context);
  assert.notEqual(s17.values.stand, h17.values.stand);
});
test('negative peek with no possible hole card reports unavailable, not fabricated EV', () => {
  const result = calculateEV(tinyShoe(['A', 'A']), ['10', '8'], '10', DEFAULT_RULES, DEFAULT_CONTEXT);
  assert.equal(result.values.stand, undefined); assert.ok(result.unavailable.stand);
});
test('latency budget produces missing values with explanations', () => {
  const result = calculateEV(freshShoe(6), ['A', '2'], '2', DEFAULT_RULES, DEFAULT_CONTEXT, 1);
  assert.equal(result.values.hit, undefined); assert.ok(result.unavailable.hit);
});
