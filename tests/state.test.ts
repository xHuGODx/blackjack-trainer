import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, reducer, calculationShoe, physicalShoe, rankRange } from '../lib/blackjack/state';
import { DEFAULT_RULES, remaining } from '../lib/blackjack/model';
test('add to advisor registers exactly once; clearing hand keeps exposed cards removed', () => {
  let s = initialState();
  s = reducer(s, { type: 'cards', cards: ['A', '10'], target: 'player', mode: 'count' });
  s = reducer(s, { type: 'cards', cards: ['6'], target: 'dealer', mode: 'count' });
  assert.equal(remaining(s.live.shoe), 309);
  assert.equal(remaining(calculationShoe(s)), 309);
  s = reducer(s, { type: 'clear' });
  assert.equal(remaining(s.live.shoe), 309);
  assert.equal(s.live.player.length, 0);
  assert.equal(s.live.dealer, null);
});
test('already counted mode never removes a card twice; rejects unrecorded cards', () => {
  let s = initialState();
  const bad = reducer(s, { type: 'cards', cards: ['A'], target: 'player', mode: 'already' });
  assert.ok(bad.error); assert.equal(bad.live.player.length, 0);
  s = reducer(s, { type: 'cards', cards: ['A', 'A', '6'], target: 'counter', mode: 'count' });
  s = reducer(s, { type: 'cards', cards: ['A', 'A'], target: 'player', mode: 'already' });
  s = reducer(s, { type: 'cards', cards: ['6'], target: 'dealer', mode: 'already' });
  assert.equal(s.error, null); assert.equal(remaining(calculationShoe(s)), 309);
});
test('preview mode leaves the counter unchanged and removes cards only for EV', () => {
  let s = initialState();
  s = reducer(s, { type: 'cards', cards: ['A', '10'], target: 'player', mode: 'preview' });
  s = reducer(s, { type: 'cards', cards: ['6'], target: 'dealer', mode: 'preview' });
  assert.equal(remaining(s.live.shoe), 312);
  assert.equal(remaining(calculationShoe(s)), 309);
});
test('undo/redo restores hand and counter atomically; new input clears redo', () => {
  let s = initialState();
  s = reducer(s, { type: 'cards', cards: ['2', '3', '4'], target: 'player', mode: 'count' });
  s = reducer(s, { type: 'undo' });
  assert.equal(remaining(s.live.shoe), 312); assert.equal(s.live.player.length, 0);
  s = reducer(s, { type: 'redo' });
  assert.equal(remaining(s.live.shoe), 309); assert.equal(s.live.player.length, 3);
  s = reducer(s, { type: 'undo' });
  s = reducer(s, { type: 'cards', cards: ['A'], target: 'counter', mode: 'count' });
  assert.equal(s.future.length, 0);
});
test('bulk removal is atomic when a rank is depleted', () => {
  const s = initialState({ ...DEFAULT_RULES, decks: 1 });
  const invalid = reducer(s, { type: 'cards', cards: ['2', 'A', 'A', 'A', 'A', 'A'], target: 'counter', mode: 'count' });
  assert.ok(invalid.error); assert.equal(remaining(invalid.live.shoe), 52); assert.equal(invalid.past.length, 0);
});
test('grouped tens preserve rank uncertainty and allow later known rank entries', () => {
  let s = initialState({ ...DEFAULT_RULES, decks: 1 });
  s = reducer(s, { type: 'group', quantity: 4 });
  assert.equal(remaining(physicalShoe(s.live.shoe, s.live.unknownTens)), 48);
  assert.deepEqual(rankRange(s.live.shoe, s.live.unknownTens, 'J'), [0, 4]);
  s = reducer(s, { type: 'cards', cards: ['10', '10', '10', '10'], target: 'counter', mode: 'count' });
  assert.equal(s.error, null);
  assert.equal(remaining(physicalShoe(s.live.shoe, s.live.unknownTens)), 44);
  s = reducer(s, { type: 'group', quantity: 9 });
  assert.ok(s.error); assert.equal(s.live.unknownTens, 4);
});
test('one unknown ten cannot back two cards marked already counted', () => {
  let s = reducer(initialState(), { type: 'group', quantity: 1 });
  s = reducer(s, { type: 'cards', cards: ['J', 'Q'], target: 'player', mode: 'already' });
  assert.ok(s.error); assert.equal(s.live.player.length, 0);
});
test('reset and deck changes clear undo stack and all live state; rule changes retain shoe', () => {
  let s = reducer(initialState(), { type: 'cards', cards: ['A'], target: 'counter', mode: 'count' });
  s = reducer(s, { type: 'rules', rules: { ...s.rules, h17: true } });
  assert.equal(s.live.shoe.A, 23);
  s = reducer(s, { type: 'rules', rules: { ...s.rules, decks: 2 } });
  assert.equal(s.past.length, 0); assert.equal(remaining(s.live.shoe), 104);
  s = reducer(s, { type: 'reset' }); assert.equal(s.future.length, 0);
});
test('dealer ace and ten entry start before peek; other upcards exclude blackjack', () => {
  let s = reducer(initialState(), { type: 'cards', cards: ['A'], target: 'dealer', mode: 'count' });
  assert.equal(s.live.context.peekCleared, false);
  s = reducer(s, { type: 'clear' });
  s = reducer(s, { type: 'cards', cards: ['5'], target: 'dealer', mode: 'count' });
  assert.equal(s.live.context.peekCleared, true);
});
