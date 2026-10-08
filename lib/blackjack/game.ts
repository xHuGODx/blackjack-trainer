import { DEFAULT_RULES, RANKS, evaluate, freshShoe, legalActions, removeCards, remaining, value, type Action, type Composition, type HandContext, type Rank, type Rules } from './model';
export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export type PlayingCard = { id: string; rank: Rank; suit: typeof SUITS[number] };
export type PlayingHand = { cards: PlayingCard[]; bet: number; originalExposure: number; afterSplit: boolean; splitAces: boolean; status: 'playing' | 'stood' | 'bust' | 'surrendered'; result: string | null; net: number | null };
export type Game = {
  rules: Rules;
  deck: PlayingCard[] | null;
  unseen: Composition;
  dealer: PlayingCard[];
  revealed: boolean;
  hands: PlayingHand[];
  active: number;
  phase: 'idle' | 'offer' | 'player' | 'result';
  balance: number;
  openingBalance: number;
  roundBet: number;
  insuranceBet: number;
  insuranceChoice: 'pending' | 'taken' | 'declined' | 'unavailable';
  earlyOffer: boolean;
  peekCleared: boolean;
  lastExposed: PlayingCard[];
  message: string;
  net: number | null;
  error: string | null;
};
export type GameCommand =
  | { type: 'deal'; bet: number; shuffled?: PlayingCard[] }
  | { type: 'action'; action: Action }
  | { type: 'insurance'; take: boolean }
  | { type: 'continue' | 'newShoe' | 'resetCredits' | 'dismiss' }
  | { type: 'rules'; rules: Rules };
export function createDeck(decks: number): PlayingCard[] {
  freshShoe(decks);
  return Array.from({ length: decks }, (_, deck) => RANKS.flatMap(rank => SUITS.map(suit => ({ rank, suit, id: `${deck}-${rank}-${suit}` })))).flat();
}
function secureIndex(upper: number): number {
  const buffer = new Uint32Array(1);
  const ceiling = 0x100000000 - 0x100000000 % upper;
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= ceiling);
  return buffer[0] % upper;
}
export function shuffleDeck(decks: number, randomIndex: (upper: number) => number = secureIndex): PlayingCard[] {
  const cards = createDeck(decks);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    if (!Number.isInteger(j) || j < 0 || j > i) throw new Error('Invalid shuffle index.');
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function newGame(rules = DEFAULT_RULES, deck: PlayingCard[] | null = null, balance = 1000): Game {
  if (deck) validateDeck(deck, rules.decks);
  return { rules, deck: deck ? [...deck] : null, unseen: freshShoe(rules.decks), dealer: [], revealed: false, hands: [], active: 0, phase: 'idle', balance, openingBalance: balance, roundBet: 0, insuranceBet: 0, insuranceChoice: 'unavailable', earlyOffer: false, peekCleared: false, lastExposed: [], message: 'Place your practice bet and deal the first hand.', net: null, error: null };
}
function validateDeck(deck: PlayingCard[], decks: number) {
  const expected = createDeck(decks);
  const ids = new Set(deck.map(card => card.id));
  const lookup = new Map(expected.map(card => [card.id, card]));
  if (deck.length !== expected.length || ids.size !== expected.length || deck.some(card => lookup.get(card.id)?.rank !== card.rank || lookup.get(card.id)?.suit !== card.suit)) throw new Error('The shuffled shoe must contain every physical card exactly once.');
}
export function needsShuffle(game: Game): boolean {
  return !game.deck || game.deck.length < 20 || (1 - game.deck.length / (52 * game.rules.decks)) * 100 >= game.rules.penetration;
}
export const ranks = (cards: readonly PlayingCard[]) => cards.map(card => card.rank);
export function gameContext(game: Game, hand = game.hands[game.active]): HandContext {
  return { afterSplit: hand?.afterSplit ?? false, splitAces: hand?.splitAces ?? false, hands: game.hands.length || 1, peekCleared: game.peekCleared };
}
export function gameActions(game: Game): Action[] {
  const hand = game.hands[game.active];
  if (!hand || hand.status !== 'playing') return [];
  if (game.phase === 'offer') return game.earlyOffer ? ['surrender'] : [];
  if (game.phase !== 'player') return [];
  return legalActions(ranks(hand.cards), game.rules, gameContext(game), game.dealer[0]?.rank).filter(action => !['double', 'split'].includes(action) || game.balance >= hand.bet);
}
class EmptyShoe extends Error {}
function clone(game: Game): Game { return { ...game, deck: game.deck ? [...game.deck] : null, unseen: { ...game.unseen }, dealer: [...game.dealer], hands: game.hands.map(hand => ({ ...hand, cards: [...hand.cards] })), lastExposed: [], error: null }; }
function expose(game: Game, card: PlayingCard) { game.unseen = removeCards(game.unseen, [card.rank]); game.lastExposed.push(card); }
function draw(game: Game, visible = true): PlayingCard {
  const card = game.deck?.shift();
  if (!card) throw new EmptyShoe('Shoe exhausted.');
  if (visible) expose(game, card);
  return card;
}
function natural(hand: PlayingHand) { return !hand.afterSplit && evaluate(ranks(hand.cards)).blackjack; }
function reveal(game: Game) {
  if (game.revealed) return;
  if (game.rules.holeCard === 'peek') expose(game, game.dealer[1]);
  else game.dealer.push(draw(game));
  game.revealed = true;
}
function finish(game: Game) {
  reveal(game);
  const dealerNatural = evaluate(ranks(game.dealer)).blackjack;
  const contest = game.hands.some(hand => hand.status !== 'surrendered' && hand.status !== 'bust' && !natural(hand));
  if (!dealerNatural && contest) {
    let dealer = evaluate(ranks(game.dealer));
    while (dealer.total < 17 || (dealer.total === 17 && dealer.soft && game.rules.h17)) {
      game.dealer.push(draw(game)); dealer = evaluate(ranks(game.dealer));
    }
  }
  const dealer = evaluate(ranks(game.dealer));
  for (const hand of game.hands) {
    let returned = 0;
    if (hand.status === 'surrendered') { returned = hand.bet / 2; hand.result = 'Surrender'; }
    else if (natural(hand)) {
      returned = dealerNatural ? hand.bet : hand.bet * 2.5;
      hand.result = dealerNatural ? 'Push · blackjack' : 'Blackjack · 3:2';
    } else if (dealerNatural) {
      returned = game.rules.holeCard === 'obo' ? hand.bet - hand.originalExposure : 0;
      hand.result = game.rules.holeCard === 'obo' && returned === hand.bet ? 'Added stake returned · OBO' : 'Dealer blackjack';
    } else if (hand.status === 'bust') hand.result = 'Bust';
    else if (dealer.bust || evaluate(ranks(hand.cards)).total > dealer.total) { returned = hand.bet * 2; hand.result = dealer.bust ? 'Win · dealer bust' : 'Win'; }
    else if (evaluate(ranks(hand.cards)).total === dealer.total) { returned = hand.bet; hand.result = 'Push'; }
    else hand.result = 'Dealer wins';
    hand.net = returned - hand.bet; game.balance += returned;
    if (hand.status === 'playing') hand.status = 'stood';
  }
  if (dealerNatural) game.balance += game.insuranceBet * 3;
  game.net = game.balance - game.openingBalance;
  game.phase = 'result';
  game.message = `${dealerNatural ? 'Dealer blackjack.' : dealer.bust ? 'Dealer busts.' : `Dealer finishes with ${dealer.total}.`} ${game.net > 0 ? 'You win' : game.net < 0 ? 'Round loss:' : 'Round breaks even.'}${game.net === 0 ? '' : ` ${Math.abs(game.net).toLocaleString('en-GB')} credits.`}`;
}
function advance(game: Game) {
  for (let index = game.active; index < game.hands.length; index++) {
    const hand = game.hands[index];
    if (hand.status !== 'playing') continue;
    const score = evaluate(ranks(hand.cards));
    if (score.bust) { hand.status = 'bust'; continue; }
    const aceResplit = hand.splitAces && score.pair && hand.cards[0].rank === 'A' && game.rules.resplitAces && game.hands.length < game.rules.maxHands && game.balance >= hand.bet;
    if (score.total === 21 || (hand.splitAces && !aceResplit)) { hand.status = 'stood'; continue; }
    game.active = index; game.phase = 'player';
    game.message = game.hands.length > 1 ? `Your move · hand ${index + 1} of ${game.hands.length}.` : 'Your move. The counter follows every exposed card.';
    return;
  }
  finish(game);
}
function beginPlayer(game: Game) {
  game.earlyOffer = false;
  if (game.insuranceChoice === 'pending') game.insuranceChoice = 'declined';
  if (game.rules.holeCard === 'peek') {
    const dealer = evaluate(ranks(game.dealer));
    if (dealer.blackjack) { finish(game); return; }
    game.peekCleared = true;
  } else game.peekCleared = game.dealer[0].rank !== 'A' && value(game.dealer[0].rank) !== 10;
  game.phase = 'player'; advance(game);
}
export function gameReducer(state: Game, command: GameCommand): Game {
  if (command.type === 'dismiss') return { ...state, error: null };
  const game = clone(state);
  try {
    const inRound = state.phase === 'offer' || state.phase === 'player';
    if (command.type === 'rules') {
      if (inRound) throw new Error('Finish the current round before changing table rules.');
      return newGame(command.rules, null, state.balance);
    }
    if (command.type === 'newShoe') {
      if (inRound) throw new Error('Finish the current round before reshuffling.');
      return newGame(state.rules, null, state.balance);
    }
    if (command.type === 'resetCredits') {
      if (inRound) throw new Error('Finish the current round before resetting practice credits.');
      return { ...newGame(state.rules, null, 1000), deck: state.deck, unseen: state.unseen, message: 'Practice balance reset to 1,000 credits. The shoe is unchanged.' };
    }
    if (command.type === 'deal') {
      if (inRound) throw new Error('Finish the current hand first.');
      if (!Number.isInteger(command.bet) || command.bet < 1 || command.bet > state.balance) throw new Error('Choose a whole-credit bet within your practice balance.');
      if (needsShuffle(state)) {
        if (!command.shuffled) throw new Error('A fresh shuffled shoe is required.');
        validateDeck(command.shuffled, state.rules.decks);
        game.deck = [...command.shuffled]; game.unseen = freshShoe(state.rules.decks);
      }
      game.openingBalance = state.balance; game.balance -= command.bet; game.roundBet = command.bet;
      game.insuranceBet = 0; game.insuranceChoice = 'unavailable'; game.earlyOffer = false; game.net = null;
      game.hands = [{ cards: [], bet: command.bet, originalExposure: command.bet, afterSplit: false, splitAces: false, status: 'playing', result: null, net: null }];
      game.active = 0; game.dealer = []; game.revealed = false; game.peekCleared = false;
      game.hands[0].cards.push(draw(game)); game.dealer.push(draw(game)); game.hands[0].cards.push(draw(game));
      if (game.rules.holeCard === 'peek') game.dealer.push(draw(game, false));
      const ace = game.dealer[0].rank === 'A';
      const canBJ = ace || value(game.dealer[0].rank) === 10;
      game.insuranceChoice = ace ? 'pending' : 'unavailable';
      game.earlyOffer = game.rules.surrender === 'early' && canBJ && !natural(game.hands[0]);
      if (ace || game.earlyOffer) { game.phase = 'offer'; game.message = game.earlyOffer ? 'Before the dealer check: early surrender or continue. Insurance is optional against an ace.' : 'Dealer shows an ace. Choose insurance or continue without it.'; }
      else beginPlayer(game);
      return game;
    }
    if (command.type === 'insurance') {
      if (game.phase !== 'offer' || game.insuranceChoice !== 'pending') throw new Error('Insurance is not available now.');
      if (command.take) {
        const cost = game.roundBet / 2;
        if (game.balance < cost) throw new Error('Not enough practice credits for insurance.');
        game.insuranceBet = cost; game.balance -= cost; game.insuranceChoice = 'taken';
      } else game.insuranceChoice = 'declined';
      if (!game.earlyOffer) beginPlayer(game);
      else game.message = 'Insurance choice recorded. Early surrender is still available before the dealer check.';
      return game;
    }
    if (command.type === 'continue') {
      if (game.phase !== 'offer') throw new Error('No pre-deal choice is pending.');
      beginPlayer(game); return game;
    }
    if (command.type === 'action') {
      if (!gameActions(state).includes(command.action)) throw new Error('That action is not legal for this hand, table rules or available credits.');
      const hand = game.hands[game.active];
      if (command.action === 'surrender') { hand.status = 'surrendered'; if (game.phase === 'offer') { game.earlyOffer = false; if (game.insuranceChoice === 'pending') game.insuranceChoice = 'declined'; } }
      if (command.action === 'stand') hand.status = 'stood';
      if (command.action === 'hit') hand.cards.push(draw(game));
      if (command.action === 'double') { game.balance -= hand.bet; hand.bet *= 2; hand.cards.push(draw(game)); hand.status = evaluate(ranks(hand.cards)).bust ? 'bust' : 'stood'; }
      if (command.action === 'split') {
        game.balance -= hand.bet;
        const ace = hand.cards[0].rank === 'A';
        const next: PlayingHand = { cards: [hand.cards[1]], bet: hand.bet, originalExposure: 0, afterSplit: true, splitAces: ace, status: 'playing', result: null, net: null };
        hand.cards = [hand.cards[0]]; hand.afterSplit = true; hand.splitAces = ace;
        hand.cards.push(draw(game)); next.cards.push(draw(game));
        game.hands.splice(game.active + 1, 0, next);
      }
      advance(game); return game;
    }
    return state;
  } catch (error) {
    if (error instanceof EmptyShoe) {
      if (game.rules.holeCard === 'peek' && !game.revealed && game.dealer[1]) { expose(game, game.dealer[1]); game.revealed = true; }
      game.balance = game.openingBalance; game.net = 0; game.phase = 'result'; game.insuranceBet = 0; game.insuranceChoice = 'unavailable';
      game.hands = game.hands.map(hand => ({ ...hand, status: 'stood', result: 'Void · stake returned', net: 0 }));
      game.message = 'Shoe exhausted: round voided and all stakes returned. The next hand uses a fresh shoe.';
      return game;
    }
    return { ...state, error: error instanceof Error ? error.message : 'Invalid game action.' };
  }
}
export function assertGameConservation(game: Game) {
  if (!game.deck) return;
  const hidden = game.rules.holeCard === 'peek' && game.dealer.length > 1 && !game.revealed ? 1 : 0;
  if (remaining(game.unseen) !== game.deck.length + hidden) throw new Error('Exposed-card conservation failed.');
}
