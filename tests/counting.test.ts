import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANKS, freshShoe, removeCards, remaining, parseCards } from '../lib/blackjack/model';
import { count, SYSTEMS, insurance } from '../lib/blackjack/counting';
const stats = (shoe = freshShoe(6), system: keyof typeof SYSTEMS = 'Hi-Lo', rounding: 'floor' | 'truncate' | 'nearest' | 'none' = 'floor') => count(shoe, 6, system, SYSTEMS['Hi-Lo'], rounding, 'exact', 6);
test('shoe capacities and transactional removal', () => {
  assert.equal(remaining(freshShoe(6)), 312);
  const shoe = freshShoe(1);
  assert.throws(() => removeCards(shoe, ['A', 'A', 'A', 'A', 'A']));
  assert.equal(shoe.A, 4);
  assert.throws(() => freshShoe(1.5));
});
test('Hi-Lo neutral cards, tens and aces; negative floor and truncation', () => {
  const shoe = removeCards(freshShoe(6), ['2', '3', '4', '5', '6', '7', '8', '9', 'A', '10', 'J', 'Q', 'K']);
  assert.equal(stats(shoe).rc, 0);
  const negative = removeCards(freshShoe(6), ['10']);
  assert.equal(stats(negative).tc, -1);
  assert.equal(stats(negative, 'Hi-Lo', 'truncate').tc, 0);
  assert.equal(stats(negative, 'Hi-Lo', 'nearest').tc, 0);
  assert.ok(stats(negative, 'Hi-Lo', 'none').tc! < 0);
});
test('all balanced systems return to zero over a complete shoe; KO ends at +4', () => {
  const shoe = removeCards(freshShoe(6), RANKS.flatMap(rank => Array(24).fill(rank)));
  for (const system of Object.keys(SYSTEMS) as (keyof typeof SYSTEMS)[]) {
    assert.equal(stats(shoe, system).rc, system === 'KO' ? 4 : 0);
    assert.equal(stats(shoe, system).tc, null);
  }
  assert.equal(stats(freshShoe(6), 'KO').rc, -20);
  assert.equal(stats(freshShoe(6), 'KO').tc, null);
});
test('systems recalculate from the same shoe without resetting', () => {
  const shoe = removeCards(freshShoe(6), ['A', '2', '7', '9', '10']);
  assert.equal(stats(shoe).rc, -1);
  assert.equal(stats(shoe, 'Hi-Opt II').rc, 0);
  assert.equal(stats(shoe, 'Omega II').rc, -1);
  assert.equal(stats(shoe, 'Zen Count').rc, -1);
  assert.equal(stats(shoe, 'Hi-Opt I').rc, -1);
});
test('deck estimation methods and exact penetration', () => {
  const shoe = removeCards(freshShoe(6), Array(20).fill('2'));
  assert.equal(stats(shoe).seen, 20);
  assert.equal(stats(shoe).cardsLeft, 292);
  assert.equal(stats(shoe).exactDecks, 292 / 52);
  assert.equal(count(shoe, 6, 'Hi-Lo', SYSTEMS['Hi-Lo'], 'none', 'half', 6).estimatedDecks, 5.5);
  assert.equal(count(shoe, 6, 'Hi-Lo', SYSTEMS['Hi-Lo'], 'none', 'quarter', 6).estimatedDecks, 5.5);
  assert.equal(count(shoe, 6, 'Hi-Lo', SYSTEMS['Hi-Lo'], 'none', 'whole', 6).estimatedDecks, 6);
  assert.equal(count(shoe, 6, 'Hi-Lo', SYSTEMS['Hi-Lo'], 'none', 'manual', 4).tc, 5);
});
test('custom balanced and unbalanced count systems', () => {
  const custom = [0, 2, 0, 0, 0, 0, 0, 0, 0, -2, 0, 0, 0];
  const shoe = removeCards(freshShoe(6), ['2']);
  assert.equal(count(shoe, 6, 'Custom', custom, 'floor', 'exact', 6).rc, 2);
  assert.equal(count(shoe, 6, 'Custom', Array(13).fill(1), 'floor', 'exact', 6).tc, null);
});
test('insurance exact 2:1 payoff and integer break-even comparison', () => {
  assert.equal(insurance(freshShoe(6))!.take, false);
  const shoe = { ...Object.fromEntries(RANKS.map(rank => [rank, 0])), A: 2, '10': 1 } as ReturnType<typeof freshShoe>;
  assert.equal(insurance(shoe)!.neutral, true);
  assert.equal(insurance(shoe)!.ev, 0);
  shoe['10'] = 2;
  assert.equal(insurance(shoe)!.take, true);
  assert.equal(insurance(shoe)!.ev, .5);
});
test('bulk input validates tokens and repeat limits', () => {
  assert.deepEqual(parseCards('a, 2x3; T K'), ['A', '2', '2', '2', '10', 'K']);
  assert.throws(() => parseCards('10 garbage 2'));
  assert.throws(() => parseCards('2x0'));
  assert.throws(() => parseCards(''));
});
