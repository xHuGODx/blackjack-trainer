import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basicStrategy, countDeviation } from '../lib/blackjack/strategy';
import { DEFAULT_RULES, DEFAULT_CONTEXT, evaluate, legalActions, type Rank, type Rules, type Action } from '../lib/blackjack/model';
const UP: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
const code = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' };
const advise = (cards: Rank[], dealer: Rank, changes: Partial<Rules> = {}) => basicStrategy(cards, dealer, { ...DEFAULT_RULES, ...changes })?.action;
// Golden rows transcribed as factual decisions from the six Wizard of Odds
// standard charts linked in docs/mathematics.md. They are independent fixtures.
const SOFT = {
  '1s': ['HHHDDHHHHH', 'HHDDDHHHHH', 'HHDDDHHHHH', 'HHDDDHHHHH', 'DDDDDHHHHH', 'SDDDDSSHHS', 'SSSSDSSSSS', 'SSSSSSSSSS'],
  '1h': ['HHHDDHHHHH', 'HHDDDHHHHH', 'HHDDDHHHHH', 'HHDDDHHHHH', 'DDDDDHHHHH', 'SDDDDSSHHH', 'SSSSDSSSSS', 'SSSSSSSSSS'],
  '2s': ['HHHDDHHHHH', 'HHHDDHHHHH', 'HHDDDHHHHH', 'HHDDDHHHHH', 'HDDDDHHHHH', 'SDDDDSSHHS', 'SSSSSSSSSS', 'SSSSSSSSSS'],
  '2h': ['HHHDDHHHHH', 'HHHDDHHHHH', 'HHDDDHHHHH', 'HHDDDHHHHH', 'HDDDDHHHHH', 'DDDDDSSHHH', 'SSSSDSSSSS', 'SSSSSSSSSS'],
  '6s': ['HHHDDHHHHH', 'HHHDDHHHHH', 'HHDDDHHHHH', 'HHDDDHHHHH', 'HDDDDHHHHH', 'SDDDDSSHHH', 'SSSSSSSSSS', 'SSSSSSSSSS'],
  '6h': ['HHHDDHHHHH', 'HHHDDHHHHH', 'HHDDDHHHHH', 'HHDDDHHHHH', 'HDDDDHHHHH', 'DDDDDSSHHH', 'SSSSDSSSSS', 'SSSSSSSSSS'],
};
for (const [key, rows] of Object.entries(SOFT)) {
  test(`all soft-total chart cells: ${key}`, () => {
    for (let i = 0; i < rows.length; i++) for (let j = 0; j < UP.length; j++) {
      const cards: Rank[] = ['A', String(i + 2) as Rank];
      const action = advise(cards, UP[j], { decks: Number(key[0]), h17: key[1] === 'h', surrender: 'none' });
      assert.equal(code[action!], rows[i][j], `soft ${i + 13} vs ${UP[j]}`);
    }
  });
}
const PAIRS: Record<string, string[]> = {
  '1sD': ['PPPPPPHHHH', 'PPPPPPPHHH', 'HHPPPHHHHH', 'DDDDDDDDHH', 'PPPPPPHHHH', 'PPPPPPPHSH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '1hD': ['PPPPPPHHHH', 'PPPPPPHHHH', 'HHPPPHHHHH', 'DDDDDDDDHH', 'PPPPPPHHHH', 'PPPPPPPHSH', 'PPPPPPPPPP', 'PPPPPSPPSP', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '1sN': ['HPPPPPHHHH', 'HHPPPPHHHH', 'HHHDDHHHHH', 'DDDDDDDDHH', 'PPPPPHHHHH', 'PPPPPPHHSH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '1hN': ['HPPPPPHHHH', 'HHPPPHHHHH', 'HHHDDHHHHH', 'DDDDDDDDHH', 'PPPPPHHHHH', 'PPPPPPHHSH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '2sD': ['PPPPPPHHHH', 'PPPPPPHHHH', 'HHHPPHHHHH', 'DDDDDDDDHH', 'PPPPPPHHHH', 'PPPPPPPHHH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '2hD': ['PPPPPPHHHH', 'PPPPPPHHHH', 'HHHPPHHHHH', 'DDDDDDDDHH', 'PPPPPPHHHH', 'PPPPPPPHHH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '2sN': ['HHPPPPHHHH', 'HHPPPPHHHH', 'HHHHHHHHHH', 'DDDDDDDDHH', 'PPPPPHHHHH', 'PPPPPPHHHH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '2hN': ['HHPPPPHHHH', 'HHPPPPHHHH', 'HHHHHHHHHH', 'DDDDDDDDHH', 'PPPPPHHHHH', 'PPPPPPHHHH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '6sD': ['PPPPPPHHHH', 'PPPPPPHHHH', 'HHHPPHHHHH', 'DDDDDDDDHH', 'PPPPPHHHHH', 'PPPPPPHHHH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '6hD': ['PPPPPPHHHH', 'PPPPPPHHHH', 'HHHPPHHHHH', 'DDDDDDDDHH', 'PPPPPHHHHH', 'PPPPPPHHHH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '6sN': ['HHPPPPHHHH', 'HHPPPPHHHH', 'HHHHHHHHHH', 'DDDDDDDDHH', 'HPPPPHHHHH', 'PPPPPPHHHH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
  '6hN': ['HHPPPPHHHH', 'HHPPPPHHHH', 'HHHHHHHHHH', 'DDDDDDDDHH', 'HPPPPHHHHH', 'PPPPPPHHHH', 'PPPPPPPPPP', 'PPPPPSPPSS', 'SSSSSSSSSS', 'PPPPPPPPPP'],
};
for (const [key, rows] of Object.entries(PAIRS)) test(`all pair chart cells: ${key}`, () => {
  for (let i = 0; i < rows.length; i++) for (let j = 0; j < UP.length; j++) {
    const rank = i === 9 ? 'A' : String(i + 2) as Rank;
    const action = advise([rank, rank], UP[j], { decks: Number(key[0]), h17: key[1] === 'h', das: key[2] === 'D', surrender: 'none' });
    assert.equal(code[action!], rows[i][j], `${rank},${rank} vs ${UP[j]}`);
  }
});
test('hard total golden decision rows including deck-specific doubling', () => {
  const cases: [number, boolean, number, string][] = [
    [1, false, 8, 'HHHDDHHHHH'], [1, false, 9, 'DDDDDHHHHH'], [2, false, 9, 'DDDDDHHHHH'], [6, false, 9, 'HDDDDHHHHH'],
    [6, false, 10, 'DDDDDDDDHH'], [6, false, 11, 'DDDDDDDDDH'], [6, true, 11, 'DDDDDDDDDD'], [2, false, 11, 'DDDDDDDDDD'],
    [6, false, 12, 'HHSSSHHHHH'], [6, false, 13, 'SSSSSHHHHH'], [6, false, 16, 'SSSSSHHHHH'], [6, true, 17, 'SSSSSSSSSS'],
  ];
  for (const [decks, h17, total, row] of cases) for (let j = 0; j < UP.length; j++) {
    const cards: Rank[] = total <= 11 ? ['2', String(total - 2) as Rank] : ['10', String(total - 10) as Rank];
    assert.equal(code[advise(cards, UP[j], { decks, h17, surrender: 'none' })!], row[j], `${decks}/${h17}: ${total} vs ${UP[j]}`);
  }
});
test('aces soften once and harden correctly with more than one ace', () => {
  assert.equal(evaluate(['A', 'A', '5']).total, 17);
  assert.equal(evaluate(['A', 'A', '5']).soft, true);
  assert.equal(evaluate(['A', 'A', '10']).total, 12);
  assert.equal(evaluate(['A', 'A', '10']).soft, false);
  assert.equal(evaluate(['10', 'K', '2']).bust, true);
});
test('double restrictions and multicard hands use correct fallback', () => {
  assert.equal(advise(['A', '7'], '6', { double: '10-11' }), 'stand');
  assert.equal(advise(['A', '6'], '6', { double: '9-11' }), 'hit');
  assert.equal(advise(['2', '3', '6'], '6'), 'hit');
  assert.equal(advise(['3', '5'], '6', { decks: 1, double: '9-11' }), 'hit');
});
test('surrender applies before splitting only to documented exceptions', () => {
  assert.equal(advise(['8', '8'], 'A', { h17: true }), 'surrender');
  assert.equal(advise(['8', '8'], 'A', { decks: 2, h17: true, das: true }), 'split');
  assert.equal(advise(['8', '8'], 'A', { decks: 2, h17: true, das: false }), 'surrender');
  assert.equal(advise(['7', '7'], '10', { decks: 1 }), 'surrender');
  assert.equal(advise(['7', '7'], 'A', { decks: 1, h17: true }), 'surrender');
  assert.equal(advise(['10', '6'], '9', { decks: 1 }), 'hit');
  assert.equal(advise(['10', '6'], '9', { decks: 6 }), 'surrender');
  assert.equal(advise(['10', '5'], '10', { decks: 1 }), 'hit');
  assert.equal(advise(['10', '7'], 'A', { h17: true }), 'surrender');
  assert.equal(advise(['10', '6'], '10', { surrender: 'none' }), 'hit');
});
test('early surrender before dealer blackjack; special small-deck exceptions', () => {
  assert.equal(advise(['2', '3'], 'A', { surrender: 'early' }), 'surrender');
  assert.equal(advise(['10', '4'], '10', { surrender: 'early' }), 'surrender');
  assert.equal(advise(['10', '4'], '10', { surrender: 'early', decks: 1 }), 'hit');
  assert.equal(advise(['10', '4'], '10', { surrender: 'early', decks: 2 }), 'hit');
  assert.equal(advise(['8', '8'], '10', { surrender: 'early', decks: 1, das: true }), 'split');
});
test('ENHC protects added bets; OBO follows original-bet strategy', () => {
  assert.equal(advise(['5', '6'], '10', { holeCard: 'enhc', surrender: 'none' }), 'hit');
  assert.equal(advise(['8', '8'], '10', { holeCard: 'enhc', surrender: 'none' }), 'hit');
  assert.equal(advise(['A', 'A'], 'A', { holeCard: 'enhc', surrender: 'none' }), 'hit');
  assert.equal(advise(['A', 'A'], '10', { holeCard: 'enhc', surrender: 'none' }), 'split');
  assert.equal(advise(['10', '6'], '10', { holeCard: 'enhc' }), 'hit');
  assert.equal(advise(['10', '6'], '9', { holeCard: 'enhc' }), 'surrender');
  assert.equal(advise(['5', '6'], '10', { holeCard: 'obo', surrender: 'none' }), 'double');
});
test('split context respects DAS, hand limit, resplitting aces, and one-card ace rule', () => {
  const context = { ...DEFAULT_CONTEXT, afterSplit: true, hands: 2 };
  assert.ok(!legalActions(['5', '6'], { ...DEFAULT_RULES, das: false }, context).includes('double'));
  assert.equal(basicStrategy(['8', '8'], '6', { ...DEFAULT_RULES, maxHands: 2 }, context)!.action, 'stand');
  const aces = { ...context, splitAces: true };
  assert.deepEqual(legalActions(['A', '5'], DEFAULT_RULES, aces), ['stand']);
  assert.equal(basicStrategy(['A', 'A'], '6', DEFAULT_RULES, aces)!.action, 'stand');
  assert.equal(basicStrategy(['A', 'A'], '6', { ...DEFAULT_RULES, resplitAces: true }, aces)!.action, 'split');
});
test('Hi-Lo index boundaries and unsupported systems/rules', () => {
  const rules = { ...DEFAULT_RULES, surrender: 'none' as const };
  const d = (cards: Rank[], dealer: Rank, tc: number) => countDeviation(cards, dealer, rules, DEFAULT_CONTEXT, 'Hi-Lo', 'floor', tc);
  assert.equal(d(['10', '6'], '10', -1)!.action, 'hit');
  assert.equal(d(['10', '6'], '10', 0)!.action, 'stand');
  assert.equal(d(['10', '2'], '3', 1)!.action, 'hit');
  assert.equal(d(['10', '2'], '3', 2)!.action, 'stand');
  assert.equal(d(['10', '3'], '2', -2)!.action, 'hit');
  assert.equal(d(['10', '3'], '2', -1)!.action, 'stand');
  assert.equal(countDeviation(['10', '6'], '10', rules, DEFAULT_CONTEXT, 'Omega II', 'floor', 8), null);
  assert.equal(countDeviation(['10', '6'], '10', { ...rules, h17: true }, DEFAULT_CONTEXT, 'Hi-Lo', 'floor', 8), null);
  assert.equal(countDeviation(['10', '6'], '10', rules, DEFAULT_CONTEXT, 'Hi-Lo', 'truncate', 8), null);
  assert.equal(countDeviation(['10', '5'], '10', DEFAULT_RULES, DEFAULT_CONTEXT, 'Hi-Lo', 'floor', 0)!.action, 'surrender');
});
test('all supported rule combinations return only legal recommendations', () => {
  for (const decks of [1, 2, 4, 6, 8]) for (const h17 of [false, true]) for (const das of [false, true]) for (const double of ['any', '9-11', '10-11'] as const) for (const holeCard of ['peek', 'enhc', 'obo'] as const) for (const surrender of ['none', 'late', 'early'] as const) {
    const rules: Rules = { ...DEFAULT_RULES, decks, h17, das, double, holeCard, surrender };
    for (const cards of [['A', '7'], ['8', '8'], ['10', '6'], ['3', '5'], ['5', '6']] as Rank[][]) for (const dealer of UP) {
      const ctx = { ...DEFAULT_CONTEXT, peekCleared: holeCard === 'peek' || (dealer !== 'A' && dealer !== '10') };
      const action = basicStrategy(cards, dealer, rules, ctx)!.action as Action;
      assert.ok(legalActions(cards, rules, ctx, dealer).includes(action));
    }
  }
});
test('conditional chart fallback prefers double or split where appropriate', () => {
  assert.equal(basicStrategy(['4', '4'], '5', { ...DEFAULT_RULES, decks: 1 })!.fallback, 'double');
  assert.equal(basicStrategy(['8', '8'], 'A', { ...DEFAULT_RULES, h17: true })!.fallback, 'split');
  assert.equal(advise(['A', 'A'], '6', { maxHands: 1, surrender: 'none' }), 'double');
  assert.equal(advise(['A', 'A'], '5', { decks: 2, maxHands: 1, surrender: 'none' }), 'double');
});
test('early surrender is no longer legal against 10/A after the peek', () => {
  const rules = { ...DEFAULT_RULES, surrender: 'early' as const };
  assert.ok(!legalActions(['10', '6'], rules, DEFAULT_CONTEXT, 'A').includes('surrender'));
  assert.equal(basicStrategy(['10', '6'], 'A', rules, { ...DEFAULT_CONTEXT })!.action, 'hit');
  assert.equal(basicStrategy(['10', '6'], 'A', rules, { ...DEFAULT_CONTEXT, peekCleared: false })!.action, 'surrender');
});
