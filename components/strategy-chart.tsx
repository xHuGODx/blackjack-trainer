'use client';
import { useState } from 'react';
import { DEFAULT_CONTEXT, type Rank, type Rules } from '@/lib/blackjack/model';
import { basicStrategy, countDeviation, deviationsSupported } from '@/lib/blackjack/strategy';
import type { Rounding, System } from '@/lib/blackjack/counting';
import { Icon } from './icons';
const UP: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];
const LABELS = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split', surrender: 'Surrender' };
const LETTERS = { hit: 'H', stand: 'S', double: 'D', split: 'P', surrender: 'R' };
function rowCards(kind: string, total: number): Rank[] {
  if (kind === 'soft') return ['A', String(total - 11) as Rank];
  if (kind === 'pairs') return [total === 11 ? 'A' : String(total) as Rank, total === 11 ? 'A' : String(total) as Rank];
  // Synthetic non-pair hands define a total-dependent table, not exact composition.
  if (total <= 11) return ['2', String(total - 2) as Rank];
  if (total === 20) return ['10', '6', '4'];
  return ['10', String(total - 10) as Rank];
}
export function StrategyChart({ rules, system, rounding, tc }: { rules: Rules; system: System; rounding: Rounding; tc: number | null }) {
  const [kind, setKind] = useState('hard');
  const [showCount, setShowCount] = useState(false);
  const [selected, setSelected] = useState<{ label: string; dealer: Rank; cards: Rank[] } | null>(null);
  const totals = kind === 'hard' ? Array.from({ length: 16 }, (_, i) => 20 - i) : kind === 'soft' ? [20, 19, 18, 17, 16, 15, 14, 13] : [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const selectedAdvice = selected ? basicStrategy(selected.cards, selected.dealer, rules) : null;
  const supported = deviationsSupported(rules, system, rounding);
  return <section className="panel chart-panel">
    <div className="panel-heading"><div><span className="eyebrow">YOUR DECISION MAP</span><h2>Basic strategy chart</h2></div><span className="pill">{rules.decks} decks · {rules.h17 ? 'H17' : 'S17'}</span></div>
    <div className="chart-toolbar"><div className="segmented">{['hard', 'soft', 'pairs'].map(tab => <button key={tab} className={kind === tab ? 'selected' : ''} onClick={() => { setKind(tab); setSelected(null); }}>{tab === 'hard' ? 'Hard totals' : tab === 'soft' ? 'Soft totals' : 'Pairs'}</button>)}</div><label className="check"><input type="checkbox" checked={showCount} onChange={e => setShowCount(e.target.checked)} disabled={!supported} /> Hi-Lo deviations</label></div>
    <div className="chart-scroll"><table className="strategy-table"><caption className="sr-only">{kind} total-dependent strategy against dealer upcard</caption><thead><tr><th scope="col">Your hand</th>{UP.map(rank => <th key={rank} scope="col">{rank}</th>)}</tr></thead><tbody>{totals.map(total => {
      const cards = rowCards(kind, total);
      const label = kind === 'soft' ? `A,${total - 11}` : kind === 'pairs' ? `${total === 11 ? 'A' : total},${total === 11 ? 'A' : total}` : String(total);
      return <tr key={total}><th scope="row">{label}</th>{UP.map(dealer => {
        const advice = basicStrategy(cards, dealer, rules)!;
        const deviation = showCount ? countDeviation(cards, dealer, rules, DEFAULT_CONTEXT, system, rounding, tc) : null;
        const action = deviation?.action ?? advice.action;
        const conditional = !deviation && advice.fallback ? LETTERS[advice.fallback].toLowerCase() : '';
        return <td key={dealer}><button className={`chart-cell action-${action} ${selected?.label === label && selected.dealer === dealer ? 'cell-selected' : ''}`} aria-label={`${label} against ${dealer}: ${LABELS[action]}${advice.fallback ? `, otherwise ${LABELS[advice.fallback]}` : ''}`} onClick={() => setSelected({ label, dealer, cards })}>{LETTERS[action]}{conditional}<span className="cell-index">{deviation ? `${deviation.threshold >= 0 ? '+' : ''}${deviation.threshold}` : ''}</span></button></td>;
      })}</tr>;
    })}</tbody></table></div>
    <div className="chart-legend">{Object.entries(LABELS).map(([action, label]) => <span key={action}><i className={`legend-dot action-${action}`} />{LETTERS[action as keyof typeof LETTERS]} — {label}</span>)}</div>
    <p className="muted small">Lowercase suffix = fallback if the first action is unavailable. Charts show initial hands; split context is configured in the live advisor. Custom 3+ deck games use the multi-deck table. Ten-value pairs share a row. Early surrender of 14 vs 10 can depend on exact cards in one/two decks; use the live advisor for those exceptions.</p>
    {selected && selectedAdvice ? <div className="cell-explanation"><Icon name="info" /><div><strong>{selected.label} vs {selected.dealer}: {LABELS[selectedAdvice.action]}</strong><p>{selectedAdvice.reason} {selectedAdvice.conditional}</p>{showCount && <p>{countDeviation(selected.cards, selected.dealer, rules, DEFAULT_CONTEXT, system, rounding, tc)?.reason}</p>}</div></div> : <div className="cell-explanation muted"><Icon name="info" />Select any cell to see the decision and its conditions.</div>}
  </section>;
}
