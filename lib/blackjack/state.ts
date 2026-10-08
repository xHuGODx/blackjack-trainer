import { DEFAULT_CONTEXT, DEFAULT_RULES, freshShoe, removeCards, type Rank, type Rules, type Composition, type HandContext } from './model';
export type HandCard = { rank: Rank; registered: boolean };
export type Live = { shoe: Composition; unknownTens: number; player: HandCard[]; dealer: HandCard | null; context: HandContext };
export type State = { rules: Rules; live: Live; past: Live[]; future: Live[]; error: string | null };
export type Command =
  | { type: 'cards'; cards: Rank[]; target: 'counter' | 'player' | 'dealer'; mode: 'count' | 'already' | 'preview' }
  | { type: 'group'; quantity: number }
  | { type: 'undo' | 'redo' | 'clear' | 'reset' | 'dismiss' }
  | { type: 'rules'; rules: Rules }
  | { type: 'removePlayer'; index: number }
  | { type: 'removeDealer' }
  | { type: 'context'; context: HandContext };
export function initialState(rules = DEFAULT_RULES): State { return { rules, live: { shoe: freshShoe(rules.decks), unknownTens: 0, player: [], dealer: null, context: { ...DEFAULT_CONTEXT } }, past: [], future: [], error: null }; }
export function reducer(state: State, command: Command): State {
  try {
    if (command.type === 'dismiss') return { ...state, error: null };
    if (command.type === 'reset') return initialState(state.rules);
    if (command.type === 'rules') {
      if (command.rules.decks !== state.rules.decks) return initialState(command.rules);
      return { ...state, rules: command.rules, error: null };
    }
    if (command.type === 'undo') {
      if (!state.past.length) return state;
      return { ...state, live: state.past.at(-1)!, past: state.past.slice(0, -1), future: [...state.future, state.live], error: null };
    }
    if (command.type === 'redo') {
      if (!state.future.length) return state;
      return { ...state, live: state.future.at(-1)!, past: [...state.past, state.live], future: state.future.slice(0, -1), error: null };
    }
    let live = { ...state.live };
    if (command.type === 'clear') live = { ...live, player: [], dealer: null, context: { ...DEFAULT_CONTEXT } };
    if (command.type === 'context') live.context = command.context;
    if (command.type === 'removePlayer') live.player = live.player.filter((_, i) => i !== command.index);
    if (command.type === 'removeDealer') live.dealer = null;
    if (command.type === 'group') {
      if (!Number.isInteger(command.quantity) || command.quantity < 1) throw new Error('Grouped card quantity must be a positive whole number.');
      live.unknownTens += command.quantity;
      physicalShoe(live.shoe, live.unknownTens);
    }
    if (command.type === 'cards') {
      if (command.target === 'dealer' && (live.dealer || command.cards.length !== 1)) throw new Error('Clear the dealer card before entering a new upcard.');
      if (command.target === 'player' && live.player.length + command.cards.length > 21) throw new Error('A hand cannot contain more than 21 cards.');
      if (command.target === 'counter' || command.mode === 'count') live.shoe = removeCards(live.shoe, command.cards);
      if (command.target === 'player') live.player = [...live.player, ...command.cards.map(rank => ({ rank, registered: command.mode !== 'preview' }))];
      if (command.target === 'dealer') {
        live.dealer = { rank: command.cards[0], registered: command.mode !== 'preview' };
        live.context = { ...live.context, peekCleared: !['A', '10', 'J', 'Q', 'K'].includes(command.cards[0]) };
      }
    }
    physicalShoe(live.shoe, live.unknownTens);
    if (command.type === 'cards' && command.mode === 'already' && command.target !== 'counter') calculationShoe({ ...state, live });
    return { ...state, live, past: [...state.past, state.live], future: [], error: null };
  } catch (error) { return { ...state, error: error instanceof Error ? error.message : 'Invalid action.' }; }
}
// Unregistered cards are removed only from the calculation's copy of the shoe.
// Marking a card "already counted" means it must already exist in the counter's removals.
export function calculationShoe(state: State): Composition {
  const hand = [...state.live.player, ...(state.live.dealer ? [state.live.dealer] : [])];
  for (const rank of Object.keys(state.live.shoe) as Rank[]) {
    const registered = hand.filter(card => card.rank === rank && card.registered).length;
    if (registered > state.rules.decks * 4 - state.live.shoe[rank] + (['10', 'J', 'Q', 'K'].includes(rank) ? state.live.unknownTens : 0)) throw new Error(`Hand cards marked as counted exceed recorded ${rank} removals.`);
  }
  const tenRanks: Rank[] = ['10', 'J', 'Q', 'K'];
  const countedTens = hand.filter(card => card.registered && tenRanks.includes(card.rank)).length;
  const recordedTens = tenRanks.reduce((sum, rank) => sum + state.rules.decks * 4 - state.live.shoe[rank], 0) + state.live.unknownTens;
  if (countedTens > recordedTens) throw new Error('Hand contains more counted ten-value cards than recorded removals.');
  const known = removeCards(state.live.shoe, hand.filter(card => !card.registered).map(card => card.rank));
  return physicalShoe(known, state.live.unknownTens);
}

// Ten-value cards may be entered without their exact face. Allocation here is
// only a value-equivalent calculation representation, never a claim about rank.
export function physicalShoe(known: Composition, unknownTens: number): Composition {
  const shoe = { ...known };
  let left = unknownTens;
  for (const rank of ['10', 'J', 'Q', 'K'] as const) {
    const removed = Math.min(left, shoe[rank]); shoe[rank] -= removed; left -= removed;
  }
  if (left > 0) throw new Error('Not enough ten-value cards remain in this shoe.');
  return shoe;
}
export function rankRange(known: Composition, unknownTens: number, rank: Rank): [number, number] {
  if (!['10', 'J', 'Q', 'K'].includes(rank) || !unknownTens) return [known[rank], known[rank]];
  const total = known['10'] + known.J + known.Q + known.K - unknownTens;
  return [Math.max(0, known[rank] - unknownTens), Math.min(known[rank], total)];
}
