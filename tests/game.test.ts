import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeck, shuffleDeck, newGame, gameReducer, gameActions, assertGameConservation, needsShuffle, type Game, type GameCommand } from '../lib/blackjack/game';
import { DEFAULT_RULES, type Rank, type Rules, remaining } from '../lib/blackjack/model';
import { basicStrategy } from '../lib/blackjack/strategy';
function fixture(sequence: Rank[], overrides: Partial<Rules> = {}, balance = 1000) {
  const rules = { ...DEFAULT_RULES, ...overrides };
  const rest = createDeck(rules.decks);
  const front = sequence.map(rank => { const i = rest.findIndex(card => card.rank === rank); assert.ok(i >= 0); return rest.splice(i, 1)[0]; });
  return newGame(rules, [...front, ...rest], balance);
}
function step(game: Game, command: GameCommand) { const next = gameReducer(game, command); assert.equal(next.error, null); assertGameConservation(next); return next; }
const deal = (g: Game) => step(g, { type: 'deal', bet: 10 });
const action = (g: Game, action: 'hit' | 'stand' | 'double' | 'split' | 'surrender') => step(g, { type: 'action', action });
test('physical shuffle contains every card once and rejects invalid shuffles', () => {
  const deck = shuffleDeck(6, () => 0); assert.equal(deck.length, 312); assert.equal(new Set(deck.map(c => c.id)).size, 312);
  assert.throws(() => shuffleDeck(1, () => -1)); assert.throws(() => newGame(DEFAULT_RULES, [...deck.slice(1), deck[1]]));
});
test('hidden hole card is excluded from count until reveal; reducer is immutable', () => {
  const original = fixture(['10','6','9','10','10']); let g = deal(original);
  assert.equal(remaining(g.unseen), 309); assert.equal(g.deck!.length, 308); assert.equal(g.lastExposed.length, 3);
  assert.equal(original.deck!.length, 312); assert.equal(original.balance, 1000);
  g = action(g, 'stand'); assert.equal(g.balance, 1010); assert.equal(g.net, 10); assert.equal(remaining(g.unseen), 307); assert.equal(g.lastExposed.length, 2);
});
test('natural pays 3:2, mutual naturals push, ordinary 21 pays even money', () => {
  let g = deal(fixture(['A','9','10','7'])); assert.equal(g.balance, 1015); assert.equal(g.phase, 'result');
  g = deal(fixture(['A','A','K','Q'])); g = step(g, {type:'continue'}); assert.equal(g.balance, 1000);
  g = deal(fixture(['5','6','6','10','10','10'])); g = action(g,'hit'); assert.equal(g.balance, 1010);
});
test('dealer peek resolves blackjack before extra wagers and insurance pays 2:1', () => {
  let g = deal(fixture(['9','10','7','A'])); assert.equal(g.phase,'result'); assert.equal(g.balance,990);
  g = deal(fixture(['9','A','7','10'])); assert.equal(g.phase,'offer'); assert.equal(remaining(g.unseen),309);
  g = step(g,{type:'insurance',take:true}); assert.equal(g.balance,1000); assert.equal(g.net,0); assert.equal(remaining(g.unseen),308);
  g = deal(fixture(['A','A','K','9'])); g = step(g,{type:'insurance',take:true}); assert.equal(g.balance,1010);
});
test('double takes exactly one card and uses twice the stake', () => {
  let g = deal(fixture(['5','6','6','10','10','10'])); g = action(g,'double');
  assert.equal(g.balance,1020); assert.equal(g.hands[0].bet,20); assert.equal(g.hands[0].cards.length,3); assert.equal(g.phase,'result');
});
test('split hands play in turn, doubles use DAS and all exposed split cards count', () => {
  let g = deal(fixture(['8','6','8','10','3','2','10','10'])); g = action(g,'split');
  assert.equal(g.hands.length,2); assert.equal(g.active,0); assert.equal(g.balance,980); assert.equal(remaining(g.unseen),307);
  g = action(g,'double'); assert.equal(g.active,1); assert.equal(g.hands[0].bet,20);
  g = action(g,'stand'); assert.equal(g.balance,1030); assert.equal(g.net,30);
  g = action(deal(fixture(['8','6','8','10','3','2'],{das:false})),'split'); assert.ok(!gameActions(g).includes('double'));
});
test('split aces get one card; their 21 pays 1:1 and resplitting honors table limits', () => {
  let g = action(deal(fixture(['A','6','A','10','10','9','10'])),'split');
  assert.equal(g.phase,'result'); assert.equal(g.balance,1020); assert.equal(g.hands[0].net,10);
  g = action(deal(fixture(['A','6','A','10','A','9','10','8','10'],{resplitAces:true,maxHands:3})),'split');
  assert.equal(g.phase,'player'); assert.deepEqual(gameActions(g),['stand','split']);
  g = action(g,'split'); assert.equal(g.hands.length,3); assert.equal(g.phase,'result');
});
test('soft 17 distinguishes H17 from S17', () => {
  for (const h17 of [false,true]) {
    let g = deal(fixture(['10','A','8','6','2'],{h17})); g = step(g,{type:'continue'}); g = action(g,'stand');
    assert.equal(g.balance,h17 ? 990 : 1010); assert.equal(g.dealer.length,h17 ? 3 : 2);
  }
});
test('late surrender refunds half; early surrender precedes dealer blackjack check', () => {
  let g = action(deal(fixture(['10','10','6','9'])),'surrender'); assert.equal(g.balance,995);
  g = deal(fixture(['10','10','6','A'],{surrender:'early'})); assert.equal(g.phase,'offer'); g = action(g,'surrender'); assert.equal(g.balance,995);
  g = deal(fixture(['10','A','6','10'],{surrender:'early'})); g = step(g,{type:'insurance',take:true}); assert.equal(g.phase,'offer'); g = action(g,'surrender'); assert.equal(g.balance,1005);
});
test('no-hole-card blackjack settlement returns added OBO stakes, including doubled busts', () => {
  for (const holeCard of ['enhc','obo'] as const) for (const bust of [false,true]) {
    let g = deal(fixture(bust ? ['10','A','9','10','10'] : ['5','A','6','10','10'],{holeCard}));
    assert.equal(g.dealer.length,1); g = step(g,{type:'continue'}); assert.ok(!gameActions(g).includes('surrender'));
    g = action(g,'double'); assert.equal(g.balance,holeCard === 'obo' ? 990 : 980);
  }
});
test('OBO splits preserve exactly one original wager exposure across all hands', () => {
  let g = deal(fixture(['8','A','8','2','3','10'],{holeCard:'obo'})); g = step(g,{type:'continue'}); g = action(g,'split'); g = action(g,'stand'); g = action(g,'stand');
  assert.equal(g.balance,990); assert.deepEqual(g.hands.map(h => h.net),[-10,0]);
});
test('wallet removes unavailable doubles/splits and advice provides an affordable fallback', () => {
  let g = deal(fixture(['5','6','6','10'],{},10)); assert.ok(!gameActions(g).includes('double'));
  assert.equal(basicStrategy(['5','6'],'6',g.rules,undefined,gameActions(g))?.action,'hit');
  g = deal(fixture(['8','6','8','10'],{},10)); assert.ok(!gameActions(g).includes('split'));
  assert.equal(basicStrategy(['8','8'],'6',g.rules,undefined,gameActions(g))?.action,'stand');
});
test('illegal commands are atomic; table rules/reset are locked during rounds', () => {
  const g = deal(fixture(['10','6','9','10']));
  for (const command of [{type:'action',action:'split'},{type:'newShoe'},{type:'resetCredits'},{type:'rules',rules:DEFAULT_RULES},{type:'deal',bet:10}] as GameCommand[]) {
    const next = gameReducer(g,command); assert.ok(next.error); assert.deepEqual({...next,error:null},g);
  }
});
test('successive rounds retain inventory; cut triggers fresh shoe; credits reset independently', () => {
  let g = action(deal(fixture(['10','6','9','10','10','10','6','9','10','10'])),'stand');
  g = deal(g); assert.equal(remaining(g.unseen),304); g = action(g,'stand'); assert.equal(remaining(g.unseen),302);
  g = step(g,{type:'resetCredits'}); assert.equal(g.balance,1000); assert.equal(remaining(g.unseen),302);
  assert.equal(needsShuffle({...g,rules:{...g.rules,penetration:1}}),true);
  g = step(g,{type:'newShoe'}); assert.equal(g.deck,null); assert.equal(remaining(g.unseen),312);
  g = step(g,{type:'deal',bet:10,shuffled:shuffleDeck(6,()=>0)}); assert.ok(g.deck);
});
test('deterministic multi-round simulation conserves cards and wallet across rule variants', () => {
  let seed = 123456789;
  const rng = (upper: number) => { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed % upper; };
  for (const holeCard of ['peek','enhc','obo'] as const) for (const surrender of ['none','late','early'] as const) {
    let g = newGame({...DEFAULT_RULES,decks:1,holeCard,surrender,h17:true,resplitAces:true});
    for (let round = 0; round < 80; round++) {
      if (g.balance < 10) g = step(g,{type:'resetCredits'});
      g = step(g,{type:'deal',bet:10,...(needsShuffle(g) ? {shuffled:shuffleDeck(1,rng)} : {})});
      let moves = 0;
      while (g.phase !== 'result') {
        assert.ok(moves++ < 100,'round must finish');
        if (g.phase === 'offer') g = step(g,{type:'continue'});
        else { const available = gameActions(g); assert.ok(available.length); g = action(g,available[rng(available.length)]); }
        assert.ok(g.balance >= 0);
      }
      assert.equal(g.balance - g.openingBalance,g.net);
      assert.equal(g.hands.reduce((sum,h) => sum + h.net!,0) + (g.insuranceBet ? (g.dealer.length === 2 && g.dealer.some(c => c.rank === 'A') ? 2*g.insuranceBet : -g.insuranceBet) : 0),g.net);
    }
  }
});
