# Mathematical model and scope

This document records the implemented assumptions. The interface deliberately labels basic strategy, validated count indices and finite-composition EV separately. A recommendation is not a prediction that a hand will win.

## Shoe and count

A shoe contains 4 cards of each physical rank per whole deck, from 1 to 32 decks. Card removal is transactional: an invalid bulk entry removes nothing. Counter entry, hand registration, clearing a hand and undo/redo operate through one reducer. Clearing a current hand does not restore exposed cards; undoing a registration does.

Counting tags follow [QFIT's system comparison](https://www.qfit.com/card-counting.htm). The implemented systems are Hi-Lo, KO, Hi-Opt I/II, Omega II, Zen Count, and custom rank tags. Switching a system recalculates from the current shoe. KO begins at `4 − 4 × decks`, is unbalanced, and has no true count. A custom system starts at zero and has a TC only when its tags sum to zero per complete deck.

True count is running count divided by estimated decks remaining. Exact, nearest-quarter, nearest-half, nearest-whole and manual estimates are supported. Estimated denominators never change physical composition. Floor, truncation, nearest (JavaScript ties towards +infinity) and unrounded TC are supported. An exhausted shoe has no TC. Ace side counts are informational; they do not silently modify the main count or indices.

A grouped ten-value entry does not identify 10/J/Q/K. The state therefore keeps unknown tens separately from known rank removals. The value-composition engine can use their exact combined total, while the rank inventory displays conservative minimum/maximum ranges. Custom systems with unequal ten-value tags cannot calculate an exact count for a shoe containing unidentified tens; the UI shows an unavailable count rather than selecting arbitrary tags.

## Hand registration

- **Count:** add the exposed card to the advisor and remove it from the counter once.
- **Already counted:** add the card to the advisor without another removal. The engine checks that the corresponding rank or ten-value removal is present.
- **Preview:** leave the counter unchanged and remove the hypothetical hand cards only from a copy used by EV/insurance calculations.

All modes include both player and dealer exposed cards when preparing the calculation shoe. They never remove a hidden dealer card as an observed card. Clicking a hand card removes it from the advisor only; use Undo to reverse its counter registration.

## Basic strategy

The engine implements total-dependent initial-hand strategy for one deck, two decks, and multi-deck games, with S17/H17 and DAS/no-DAS. The golden test rows are based on the six standard charts published by Michael Shackleford:

- [Single deck](https://wizardofodds.com/games/blackjack/strategy/1-deck/)
- [Double deck](https://wizardofodds.com/games/blackjack/strategy/2-decks/)
- [Four to eight decks](https://wizardofodds.com/games/blackjack/strategy/4-decks/)
- [Surrender, including early surrender exceptions](https://wizardofodds.com/games/blackjack/surrender/)

Double restrictions and multi-card hands remove illegal doubles and apply the appropriate hit/stand fallback. Hand limits disable unavailable splits. Split aces receive one card, may resplit only when configured, and their 21 is not a natural blackjack. The original game's 3:2 natural payout is fixed.

ENHC where all stakes lose to dealer blackjack suppresses doubles against 10/A, splitting eights against 10/A, and splitting aces against A. OBO returns added double/split stakes on dealer blackjack. Late surrender against a possible blackjack is not treated as a guaranteed half-loss before a negative peek. Early surrender is evaluated before the blackjack check and respects the documented single/double-deck composition exceptions.

**Limits:** three and nine-to-32 custom deck counts use the multi-deck basic table, not a separately generated total-dependent table. Pair decisions come from the standard DAS/no-DAS charts, not a fresh optimization of arbitrary restricted-double or resplit combinations. Card depletion can change the best play; the basic chart does not claim to be a full finite-composition optimum. Where all legal initial actions have exact EVs available, the advisor additionally displays the best finite-composition action. It does not make that claim for a splittable hand whose split EV is missing.

## Count deviations

The implemented Hi-Lo index set is based on the [Illustrious 18 and Fab 4 reference](https://wizardofodds.com/games/blackjack/card-counting/high-low/). Its automated scope is deliberately restricted to six decks, S17, peek, DAS, unrestricted two-card doubles, floor-rounded TC, and non-split player hands. Unsupported systems/rules use basic strategy, rather than recycling Hi-Lo thresholds.

Surrender takes precedence when the corresponding validated index permits it. Pair-specific split indices apply only to ten-value pairs. The insurance decision uses the exact ten-value fraction instead of merely the Hi-Lo insurance benchmark.

## Finite-composition expected value

EV is calculated in a dedicated Web Worker through memoized, recursive enumeration without replacement. Values are net units relative to the original main-hand bet:

- **Stand:** resolve the dealer's distribution from the remaining physical shoe.
- **Hit:** draw one card, then choose optimal hit/stand continuation. Doubles and surrender are unavailable after another card.
- **Double:** take exactly one card and resolve the two-unit bet. OBO loses only the original unit to dealer blackjack, including where a doubled hand busts before the dealer reveals blackjack.
- **Surrender:** −0.5 when legally available.
- **Natural:** 3:2 unless the dealer also has a natural, which pushes. A split 21 receives ordinary 1:1 settlement.

For a peek game, the unknown hole card remains in the available-card population. A negative peek excludes the blackjack-completing rank from the hole-card posterior. The player's next draw then has probability

`P(draw rank r) = c[r] × (eligibleHoleCards − eligible(r)) / (eligibleHoleCards × (N − 1))`.

Here `eligible(r)` is 0 for the excluded hole rank and 1 otherwise. This conditioning continues after each player draw. The implementation does not optimize against knowledge of the hidden hole card. For no-hole-card play, the dealer's second card is drawn only after the player's action.

The finite EV fixtures match the published [six-deck S17 combinatorial returns](https://wizardofodds.com/games/blackjack/appendix/9/6ds17r4/), to the reference's six-decimal precision. Independent exhaustive physical-card permutation tests also verify doubles under peek, ENHC and OBO.

**Unavailable calculations:** split EV would require joint split-hand settlement and depletion; this version explicitly does not calculate it. A computation exceeding 600,000 memoized nodes or roughly 1.6 seconds returns unavailable values with reasons, without substituting a simulation or an invented number. Previously completed actions remain available. Invalid/depleted shoes cannot produce fictional dealer outcomes. The prominently displayed basic/index recommendation remains responsive while a calculation runs.

## Insurance and betting

Insurance is offered against A before the dealer blackjack check. The exact probability of dealer blackjack is the remaining ten-value count divided by unseen cards, after accounting for exposed player/dealer cards. At a 2:1 insurance payout, net EV per insurance unit is `3p − 1`. The break-even threshold is `p = 1/3`. Integer comparisons determine whether the bet is positive, negative or exactly neutral.

The configurable bet ramp is a user-selected stake schedule for Hi-Lo, assuming six decks, S17, peek, unrestricted doubling, DAS, and 3:2 blackjack. The ramp indexes floor-rounded raw TC. It is not a Kelly calculation, bankroll recommendation, advantage estimate, or guaranteed-profit strategy. It is disabled outside its stated scope.

## Memory and latency

There is no backend, database, account, cookie-based session, localStorage, sessionStorage, import/export, session history, or analytics. The active shoe and temporary undo stack live only in React memory. Refreshing clears both shoe state and preferences. SEO assets and the static Next.js build do not persist play data.

Workers are debounced by 160 ms, cancelled on state changes and terminated on unmount. Counting and basic strategy run synchronously without network requests. Undo/redo applies whole commands, including atomic bulk entries and combined hand/counter registration.
