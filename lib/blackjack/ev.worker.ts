import { calculateEV } from './ev';
import type { Composition, HandContext, Rank, Rules } from './model';
self.onmessage = (event: MessageEvent<{ shoe: Composition; cards: Rank[]; dealer: Rank; rules: Rules; context: HandContext }>) => {
  try {
    const { shoe, cards, dealer, rules, context } = event.data;
    self.postMessage(calculateEV(shoe, cards, dealer, rules, context));
  } catch (error) { self.postMessage({ values: {}, unavailable: {}, nodes: 0, model: '', error: error instanceof Error ? error.message : 'Calculation unavailable.' }); }
};
