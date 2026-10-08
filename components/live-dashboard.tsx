'use client';
import Link from 'next/link';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { count, cardTag, betUnits, tagsFor, insurance } from '@/lib/blackjack/counting';
import { RANKS, evaluate, legalActions, parseCards, value, type Rank, type Rules, type HandContext } from '@/lib/blackjack/model';
import { reducer, initialState, calculationShoe, physicalShoe, rankRange } from '@/lib/blackjack/state';
import { basicStrategy, countDeviation, deviationsSupported } from '@/lib/blackjack/strategy';
import type { EVResult } from '@/lib/blackjack/ev';
import { Icon } from './icons';
import { DEFAULT_PREFERENCES, TableSettings, type Preferences } from './table-settings';
import { StrategyChart } from './strategy-chart';
const ACTION_NAMES = { hit: 'Hit', stand: 'Stand', double: 'Double down', split: 'Split', surrender: 'Surrender' };
const ACTION_DETAIL = { hit: 'Take another card', stand: 'Keep your hand', double: 'Double your stake, take one card', split: 'Play the pair as two hands', surrender: 'Give up half your original stake' };
const signed = (n: number, decimals = 0) => `${n > 0 ? '+' : ''}${n.toFixed(decimals)}`;
function ProgressRing({ percentage }: { percentage: number }) {
  const circumference = 2 * Math.PI * 20;
  return <svg className="progress-ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" /><circle cx="24" cy="24" r="20" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percentage / 100)} /></svg>;
}
export function LiveDashboard() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState());
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [target, setTarget] = useState<'counter' | 'player' | 'dealer'>('counter');
  const [entryMode, setEntryMode] = useState<'count' | 'already' | 'preview'>('count');
  const [tab, setTab] = useState<'live' | 'chart'>('live');
  const [bulk, setBulk] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [evResponse, setEvResponse] = useState<{ key: string; result: EVResult } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const { rules, live } = state;
  const physical = useMemo(() => physicalShoe(live.shoe, live.unknownTens), [live.shoe, live.unknownTens]);
  const stats = count(physical, rules.decks, prefs.system, prefs.custom, prefs.rounding, prefs.estimation, prefs.manual);
  const tags = tagsFor(prefs.system, prefs.custom);
  const tenTagsEqual = tags.slice(9).every(tag => tag === tags[9]);
  const countUncertain = live.unknownTens > 0 && !tenTagsEqual;
  const tc = countUncertain ? null : stats.tc;
  const grouped = prefs.combined && tenTagsEqual && target === 'counter';
  const cards = useMemo(() => live.player.map(card => card.rank), [live.player]);
  const dealer = live.dealer?.rank;
  const context = useMemo<HandContext>(() => ({ ...live.context, peekCleared: rules.holeCard === 'peek' ? live.context.peekCleared : !!dealer && dealer !== 'A' && value(dealer) !== 10 }), [live.context, rules.holeCard, dealer]);
  const hand = evaluate(cards);
  const shoeResult = useMemo(() => {
    try { return { shoe: calculationShoe(state), error: null }; }
    catch (error) { return { shoe: null, error: error instanceof Error ? error.message : 'Invalid shoe composition.' }; }
  }, [state]);
  const base = dealer && cards.length >= 2 ? basicStrategy(cards, dealer, rules, context) : null;
  const deviation = dealer && prefs.deviations && !countUncertain ? countDeviation(cards, dealer, rules, context, prefs.system, prefs.rounding, tc) : null;
  const waitingForPeek = !!dealer && rules.holeCard === 'peek' && !context.peekCleared && (dealer === 'A' || value(dealer) === 10) && rules.surrender !== 'early';
  const recommended = deviation ?? base;
  const validHand = !!dealer && cards.length >= 2 && !hand.bust && !!shoeResult.shoe;
  const evKey = useMemo(() => JSON.stringify({ shoe: shoeResult.shoe, cards, dealer, rules, context }), [shoeResult.shoe, cards, dealer, rules, context]);
  const evReady = evResponse?.key === evKey ? evResponse.result : null;
  useEffect(() => {
    if (!validHand || !shoeResult.shoe || !dealer) return;
    let worker: Worker | undefined;
    const timer = window.setTimeout(() => {
      try {
        worker = new Worker(new URL('../lib/blackjack/ev.worker.ts', import.meta.url));
        worker.onmessage = (event: MessageEvent<EVResult>) => setEvResponse({ key: evKey, result: event.data });
        worker.onerror = () => setEvResponse({ key: evKey, result: { values: {}, unavailable: {}, nodes: 0, model: '', error: 'EV calculation is unavailable in this browser.' } });
        worker.postMessage({ shoe: shoeResult.shoe, cards, dealer, rules, context });
      } catch { setEvResponse({ key: evKey, result: { values: {}, unavailable: {}, nodes: 0, model: '', error: 'Web Workers are required to calculate EV.' } }); }
    }, 160);
    return () => { window.clearTimeout(timer); worker?.terminate(); };
  }, [evKey, validHand, shoeResult.shoe, cards, dealer, rules, context]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (dialog.current?.open) return;
      const element = event.target as HTMLElement;
      if (element.closest('input:not([type="checkbox"]), textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toUpperCase();
      if ((event.ctrlKey || event.metaKey) && key === 'Z') { event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }); return; }
      if ((event.ctrlKey || event.metaKey) && key === 'Y') { event.preventDefault(); dispatch({ type: 'redo' }); return; }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.repeat) return;
      if (key === 'BACKSPACE') { event.preventDefault(); dispatch({ type: 'undo' }); return; }
      if (key === 'ESCAPE') { dispatch({ type: 'clear' }); return; }
      if (key === 'N' && event.shiftKey) { dispatch({ type: 'reset' }); return; }
      if (key === 'C' || key === 'P' || key === 'D') { setTab('live'); setTarget(key === 'C' ? 'counter' : key === 'P' ? 'player' : 'dealer'); return; }
      const rank = key === '0' || key === 'T' ? '10' : key as Rank;
      if (RANKS.includes(rank)) {
        event.preventDefault();
        if (grouped && rank === '10') dispatch({ type: 'group', quantity: 1 });
        else dispatch({ type: 'cards', cards: [rank], target, mode: entryMode });
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [target, entryMode, grouped]);
  const onRules = (next: Rules) => dispatch({ type: 'rules', rules: next });
  const setContext = (changes: Partial<HandContext>) => dispatch({ type: 'context', context: { ...live.context, ...changes } });
  const addCard = (rank: Rank) => {
    if (grouped && rank === '10') dispatch({ type: 'group', quantity: 1 });
    else dispatch({ type: 'cards', cards: [rank], target, mode: entryMode });
  };
  const addBulk = (event: React.FormEvent) => {
    event.preventDefault();
    try { const parsed = parseCards(bulk); setBulkError(''); dispatch({ type: 'cards', cards: parsed, target, mode: entryMode }); }
    catch (error) { setBulkError(error instanceof Error ? error.message : 'Invalid card list.'); }
  };
  const insuranceResult = dealer === 'A' && shoeResult.shoe ? insurance(shoeResult.shoe) : null;
  const insuranceAvailable = dealer === 'A' && !(rules.holeCard === 'peek' && context.peekCleared);
  const rampSupported = prefs.system === 'Hi-Lo' && rules.decks === 6 && !rules.h17 && rules.das && rules.double === 'any' && rules.holeCard === 'peek' && rules.surrender !== 'early';
  const units = rampSupported ? betUnits(countUncertain ? null : stats.rawTC, prefs.spread) : null;
  const cutReached = stats.penetration >= rules.penetration;
  const legal = legalActions(cards, rules, context, dealer);
  const compositionBest = evReady && legal.length > 0 && legal.every(action => evReady.values[action] !== undefined) && !waitingForPeek ? [...legal].sort((a, b) => evReady.values[b]! - evReady.values[a]!)[0] : null;
  const scrollToCards = (destination: 'counter' | 'player') => {
    setTarget(destination);
    document.querySelector('.input-panel')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  const inputRanks: readonly Rank[] = grouped ? RANKS.slice(0, 10) : RANKS;
  return <div className={`app-layout ${prefs.compact ? 'compact' : ''} ${prefs.large ? 'large-buttons' : ''}`}>
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="Blackjack Trainer home"><span className="brand-mark">♠</span><span>blackjack<span className="brand-secondary">TRAINER</span></span></Link>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation"><button className={tab === 'live' ? 'nav-button active' : 'nav-button'} onClick={() => setTab('live')}><Icon name="cards" />Live table<span className="live-dot" /></button><button className={tab === 'chart' ? 'nav-button active' : 'nav-button'} onClick={() => setTab('chart')}><Icon name="chart" />Strategy chart</button><button className="nav-button" onClick={() => dialog.current?.showModal()}><Icon name="settings" />Table rules</button></nav>
      <div className="sidebar-bottom"><div className="privacy-note"><Icon name="shield" /><strong>Just you and the shoe.</strong><p>No accounts. No saved sessions.<br />Everything clears on refresh.</p></div><a className="creator" href="https://hugosantosribeiro.me" target="_blank" rel="noreferrer">Made by Hugo Santos Ribeiro <span>↗</span></a></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Workspace <Icon name="chevron" size={13} /><strong>{tab === 'live' ? 'Live table' : 'Strategy chart'}</strong></div><div className="topbar-right"><span className="memory-status"><i />In-memory only</span><button className="icon-button" onClick={() => dialog.current?.showModal()} aria-label="Settings and keyboard shortcuts"><Icon name="settings" /></button></div></header>
      <main className="main-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="live-dot" /> LIVE BLACKJACK ASSISTANT</div><h1>{tab === 'live' ? 'The edge is in the details.' : 'Make every decision count.'}</h1><p>{tab === 'live' ? 'Track the shoe. Read the count. Play the right hand.' : 'A decision map that adapts to your table rules.'}</p></div><button className="button secondary reset-button" onClick={() => dispatch({ type: 'reset' })}><Icon name="reset" /> New shoe <kbd>⇧ N</kbd></button></div>
        <div className="rules-strip"><span className="rules-label">TABLE RULES</span><span>{rules.decks} decks</span><i /><span>{rules.h17 ? 'H17' : 'S17'}</span><i /><span>{rules.das ? 'DAS' : 'No DAS'}</span><i /><span>{rules.holeCard === 'peek' ? 'Dealer peek' : rules.holeCard === 'enhc' ? 'ENHC · all bets' : 'ENHC · OBO'}</span><i /><span>{rules.surrender === 'none' ? 'No surrender' : `${rules.surrender === 'late' ? 'Late' : 'Early'} surrender`}</span><i /><span>3:2 blackjack</span><button onClick={() => dialog.current?.showModal()}>Edit rules <Icon name="settings" size={14} /></button></div>
        {(state.error || bulkError) && <div className="error-banner" role="alert"><Icon name="info" /><span>{state.error ?? bulkError}</span><button aria-label="Dismiss error" onClick={() => { dispatch({ type: 'dismiss' }); setBulkError(''); }}><Icon name="close" /></button></div>}
        {countUncertain && <div className="error-banner" role="alert">Grouped ten-value cards cannot be assigned different custom tags. Set the 10/J/Q/K tags equal, or start a new shoe to enter exact ranks.</div>}
        {tab === 'chart' ? <StrategyChart rules={rules} system={prefs.system} rounding={prefs.rounding} tc={tc} /> : <>
          <div className="live-grid">
            <section className="counter-column" aria-label="Live card counter">
              <div className="panel count-panel"><div className="panel-heading"><div className="section-title"><span className="live-dot" /><h2>Live count</h2></div><label className="inline-select"><span className="sr-only">Counting system</span><select value={prefs.system} onChange={e => setPrefs({ ...prefs, system: e.target.value as Preferences['system'] })}>{['Hi-Lo', 'KO', 'Hi-Opt I', 'Hi-Opt II', 'Omega II', 'Zen Count', 'Custom'].map(name => <option key={name}>{name}</option>)}</select></label></div>
                <div className="count-display"><div className="true-count"><span className="metric-label">TRUE COUNT <span className="info-label" title="Running count divided by estimated decks remaining, using the selected rounding method.">ⓘ</span></span><div className={tc !== null && tc > 0 ? 'count-number positive' : tc !== null && tc < 0 ? 'count-number negative' : 'count-number'} data-testid="true-count">{tc === null ? '—' : signed(tc, prefs.rounding === 'none' ? 2 : 0)}</div><span className={`count-status ${tc !== null && tc >= 2 ? 'positive' : ''}`}>{!stats.cardsLeft ? 'Shoe empty' : !stats.isBalanced ? 'Running-count system' : tc !== null && tc >= 2 ? 'Positive count' : tc !== null && tc < 0 ? 'Negative count' : 'Neutral count'}</span></div><div className="running-count"><span className="metric-label">RUNNING COUNT</span><strong data-testid="running-count">{countUncertain ? '—' : signed(stats.rc, Number.isInteger(stats.rc) ? 0 : 1)}</strong><span>{prefs.system === 'KO' ? `KO initial: ${4 - 4 * rules.decks}` : `${prefs.system} system`}</span>{tc !== null && <div className="raw-count">Raw TC <b>{signed(stats.rawTC!, 2)}</b></div>}</div></div>
                <div className="shoe-metrics"><div><span className="metric-label">DECKS LEFT</span><strong>{stats.exactDecks.toFixed(2)}<small> / {rules.decks}</small></strong></div><div><span className="metric-label">CARDS SEEN</span><strong><span data-testid="cards-seen">{stats.seen}</span><small> / {52 * rules.decks}</small></strong></div><div><span className="metric-label">CARDS LEFT</span><strong>{stats.cardsLeft}</strong></div></div>
                <div className="penetration"><div><span>Shoe penetration</span><strong className={cutReached ? 'gold' : ''}>{stats.penetration.toFixed(1)}%<span> / {rules.penetration}% cut</span></strong></div><div className="progress-track"><div style={{ width: `${stats.penetration}%` }} /><i style={{ left: `${rules.penetration}%` }} /></div>{cutReached && <p className="gold small">Cut-card depth reached. Start a new shoe after the reshuffle.</p>}</div>
                {prefs.estimation !== 'exact' && <p className="small muted estimation-note">TC denominator: {stats.estimatedDecks.toFixed(2)} estimated decks ({prefs.estimation}). Actual cards remain unchanged.</p>}
              </div>
              <div className="panel input-panel"><div className="panel-heading"><div><h2>Exposed cards</h2><p className="muted small">Every card matters. Tap or use your keyboard.</p></div><div className="undo-controls"><button className="icon-button" aria-label="Undo last action" title="Undo · Ctrl+Z" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}><Icon name="undo" /></button><button className="icon-button" aria-label="Redo last action" title="Redo · Ctrl+Shift+Z" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}><Icon name="redo" /></button></div></div>
                <div className="input-toolbar"><div className="segmented input-target" aria-label="Card entry destination">{(['counter', 'player', 'dealer'] as const).map(destination => <button key={destination} aria-pressed={target === destination} onClick={() => setTarget(destination)} className={target === destination ? 'selected' : ''}>{destination === 'counter' ? 'Counter' : destination === 'player' ? 'My hand' : 'Dealer'}<kbd>{destination === 'counter' ? 'C' : destination === 'player' ? 'P' : 'D'}</kbd></button>)}</div><label className="check combine-check"><input type="checkbox" checked={prefs.combined} onChange={e => setPrefs({ ...prefs, combined: e.target.checked })} disabled={!tenTagsEqual} /> Combine 10s</label></div>
                {target !== 'counter' && <label className="registration-select">Card registration<select value={entryMode} onChange={e => setEntryMode(e.target.value as typeof entryMode)}><option value="count">Add to hand + count once</option><option value="already">Already in counter · do not count again</option><option value="preview">Preview only · leave counter unchanged</option></select></label>}
                <div className={`card-input-grid ${grouped ? 'grouped' : ''}`}>{inputRanks.map(rank => {
                  const tag = cardTag(rank, prefs.system, prefs.custom);
                  const faceGroup = grouped && rank === '10';
                  const range = rankRange(live.shoe, live.unknownTens, rank);
                  const available = faceGroup ? physical['10'] + physical.J + physical.Q + physical.K : range[1];
                  return <button key={rank} className={`card-input ${tag > 0 ? 'low-card' : tag < 0 ? 'high-card' : ''} ${faceGroup ? 'ten-group' : ''}`} aria-label={faceGroup ? 'Count a ten-value card' : `Add ${rank} to ${target}`} disabled={(available === 0 && (target === 'counter' || entryMode !== 'already')) || (target === 'dealer' && !!dealer)} onClick={() => addCard(rank)}><span className="card-rank">{rank}</span><span className="card-suit" aria-hidden="true">{rank === 'A' ? '♠' : ['J', 'Q', 'K'].includes(rank) ? '♣' : '♦'}</span><span className="card-tag">{tag > 0 ? '+' : ''}{tag}</span>{faceGroup && <span className="ten-caption">10 / J / Q / K</span>}</button>;
                })}</div>
                <div className="keyboard-hint"><Icon name="keyboard" size={15} /><span><kbd>A</kbd> <kbd>2</kbd>–<kbd>9</kbd> <kbd>0</kbd>/<kbd>T</kbd> <kbd>J</kbd> <kbd>Q</kbd> <kbd>K</kbd></span><span className="input-destination">Entering to <b>{target === 'player' ? 'your hand' : target}</b></span></div>
                <form className="bulk-entry" onSubmit={addBulk}><label className="sr-only" htmlFor="bulk-cards">Bulk card entry</label><input id="bulk-cards" value={bulk} onChange={e => setBulk(e.target.value)} placeholder="Bulk entry: A 5 10 K · or 2x4" autoComplete="off" spellCheck={false} /><button className="button secondary" disabled={!bulk.trim()} type="submit">Add cards <Icon name="arrow" size={16} /></button></form>
              </div>
            </section>
            <section className="panel advisor-panel" aria-label="Live strategy advisor"><div className="panel-heading"><div className="section-title"><Icon name="cards" /><h2>Strategy advisor</h2></div><span className="pill emerald">LIVE</span></div>
              <div className="hand-entry"><div className="hand-label"><span className="metric-label">YOUR HAND</span><button className="text-button" onClick={() => { setTarget('player'); setTab('live'); }}>Add cards +</button></div><div className="playing-hand">{live.player.length ? live.player.map((card, i) => <button key={i} className="playing-card" aria-label={`Remove ${card.rank} from hand only`} title={`${card.registered ? 'Already counted' : 'Preview only'} · click to remove from hand (shoe unchanged)`} onClick={() => dispatch({ type: 'removePlayer', index: i })}><span>{card.rank}</span><span aria-hidden="true">♠</span><small>{card.registered ? 'COUNTED' : 'PREVIEW'}</small></button>) : <><button className="playing-card ghost" aria-label="Enter player cards" onClick={() => setTarget('player')}>+</button><div className="playing-card ghost decorative" aria-hidden="true">♠</div></>}<div className="hand-total"><strong>{cards.length ? hand.total : '—'}</strong><span>{!cards.length ? 'Hand total' : hand.bust ? 'Bust' : hand.soft ? 'Soft total' : 'Hard total'}</span></div></div></div>
              <div className="dealer-entry"><div><span className="metric-label">DEALER UPCARD</span><p className="small muted">One exposed card</p></div><div>{live.dealer ? <button className="dealer-card" aria-label="Clear dealer upcard" title="Clear upcard (counter unchanged)" onClick={() => dispatch({ type: 'removeDealer' })}>{dealer}<span aria-hidden="true">♣</span></button> : <button className="dealer-card ghost" aria-label="Enter dealer upcard" onClick={() => setTarget('dealer')}>+</button>}</div></div>
              <div className={`recommendation ${validHand && recommended && !waitingForPeek ? `action-${recommended.action}` : 'empty-recommendation'}`} aria-live="polite"><span className="eyebrow">{deviation ? 'COUNT-BASED DEVIATION' : 'BASIC STRATEGY'}</span><div className="recommendation-action"><h3>{shoeResult.error ? 'Check card entries' : hand.bust ? 'Hand is bust' : waitingForPeek ? 'Wait for dealer peek' : recommended ? ACTION_NAMES[recommended.action] : 'Your next move'}</h3>{recommended && !waitingForPeek && <Icon name="arrow" size={28} />}</div><p>{shoeResult.error ?? (hand.bust ? 'This hand is over. Clear it to enter the next hand.' : waitingForPeek ? 'Exclude dealer blackjack before making the main-hand decision. Insurance is a separate pre-peek choice.' : recommended ? ACTION_DETAIL[recommended.action] : 'Enter at least two player cards and the dealer upcard to get a recommendation.')}</p>{recommended && !waitingForPeek && !shoeResult.error && <div className="recommendation-reason">{recommended.reason} {'conditional' in recommended ? recommended.conditional : ''}</div>}</div>
              {waitingForPeek && <button className="button primary confirm-peek" onClick={() => setContext({ peekCleared: true })}>Dealer checked · no blackjack <Icon name="shield" size={15} /></button>}
              {base && deviation && <div className="basic-comparison"><span>Basic strategy</span><strong>{ACTION_NAMES[base.action]}</strong><span className="pill gold-pill">Index {signed(deviation.threshold)}</span></div>}
              <div className="ev-section"><div className="ev-heading"><span className="metric-label">EXPECTED VALUE</span><span className="small muted">Net units / initial bet</span></div>{validHand ? <><div className="ev-actions">{legal.map(action => <div key={action}><span>{ACTION_NAMES[action]}</span><strong className={evReady?.values[action] !== undefined && evReady.values[action]! > 0 ? 'positive' : ''} title={evReady?.unavailable[action] ?? ''}>{evReady?.values[action] !== undefined ? signed(evReady.values[action]!, 4) : evReady ? 'n/a' : '…'}</strong></div>)}</div>{compositionBest && <div className="composition-decision"><span>Composition-dependent best</span><strong>{ACTION_NAMES[compositionBest]}</strong></div>}<p className="small muted ev-model">{evReady?.error ?? (evReady ? 'Finite shoe, no replacement. Hit assumes optimal hit/stand continuation. Split EV is not computed; complex hands may exceed the calculation limit.' : 'Calculating finite-shoe EV in the background…')}</p>{evReady && Object.keys(evReady.unavailable).length > 0 && <details className="ev-unavailable"><summary>Why some values are unavailable</summary>{Object.entries(evReady.unavailable).map(([action, reason]) => <p className="small muted" key={action}><strong>{ACTION_NAMES[action as keyof typeof ACTION_NAMES]}:</strong> {reason}</p>)}</details>}<p className="small muted">EV evaluates each action separately. The prominent recommendation uses the strategy table and validated indices, not a full composition-optimal split solver.</p></> : <p className="small muted">Available after you enter a valid hand. Values are calculated from the remaining shoe, never invented.</p>}</div>
              <details className="hand-context"><summary>Hand conditions <Icon name="chevron" size={13} /></summary><div className="context-fields"><label className="check"><input type="checkbox" checked={live.context.afterSplit} onChange={e => setContext({ afterSplit: e.target.checked, splitAces: e.target.checked ? live.context.splitAces : false, hands: e.target.checked ? Math.max(2, live.context.hands) : 1 })} /> This hand is after a split</label>{live.context.afterSplit && <><label className="check"><input type="checkbox" checked={live.context.splitAces} onChange={e => setContext({ splitAces: e.target.checked })} /> Split ace hand (one card only)</label><label>Hands already in play<select value={live.context.hands} onChange={e => setContext({ hands: Number(e.target.value) })}>{[2, 3, 4].map(n => <option key={n}>{n}</option>)}</select></label></>}{rules.holeCard === 'peek' && <label className="check"><input type="checkbox" checked={live.context.peekCleared} onChange={e => setContext({ peekCleared: e.target.checked })} /> Dealer blackjack already excluded</label>}<p className="small muted">For early surrender, decide before the dealer check. Before a peek, uncheck “Dealer blackjack already excluded” to evaluate insurance.</p></div></details>
              <button className="button clear-hand" disabled={!live.player.length && !dealer} onClick={() => dispatch({ type: 'clear' })}><Icon name="reset" size={16} /> Clear current hand <kbd>Esc</kbd></button>
            </section>
          </div>
          <div className="helpers-grid"><section className="panel shoe-panel"><div className="panel-heading"><div><h2>Inside the shoe</h2><p className="small muted">Remaining cards by rank</p></div><span className="pill">{stats.cardsLeft} left</span></div><div className="rank-inventory">{RANKS.map(rank => { const [min, max] = rankRange(live.shoe, live.unknownTens, rank); return <div key={rank}><span>{rank}</span><div className="inventory-bar"><i style={{ height: `${max / (rules.decks * 4) * 100}%` }} /></div><strong title={min !== max ? 'Range: grouped tens have an unknown exact face' : undefined}>{min === max ? min : `${min}–${max}`}</strong></div>; })}</div>{live.unknownTens > 0 && <p className="small muted">{live.unknownTens} ten-value cards entered without a face. Ten/face rank counts are ranges; their combined total is exact.</p>}{prefs.aces && <div className="ace-side-count"><span><span className="gold">♠</span> Ace side count</span><strong>{stats.acesSeen} seen <i /> {stats.acesLeft} remaining</strong></div>}</section>
            <section className="panel helper-panel"><div className="panel-heading"><h2>Live signals</h2><Icon name="chart" /></div><div className="signal-row"><div className="signal-icon"><Icon name="chart" /></div><div><span className="metric-label">BET RAMP</span><strong>{units === null ? 'Unavailable for these rules' : `${units} ${units === 1 ? 'unit' : 'units'} · €${(units * prefs.unit).toFixed(2)}`}</strong><p>Configured Hi-Lo stake schedule; no guaranteed profit.</p></div></div><div className="signal-row"><div className="signal-icon gold"><Icon name="shield" /></div><div><span className="metric-label">INSURANCE</span><strong>{!prefs.insuranceAlerts ? 'Alerts off' : !dealer ? 'Enter dealer upcard' : dealer !== 'A' ? 'Not offered against this upcard' : !insuranceAvailable ? 'Dealer peek already completed' : insuranceResult?.neutral ? 'Break-even composition' : insuranceResult?.take ? 'Positive insurance EV' : 'Decline insurance'}</strong>{insuranceResult && insuranceAvailable && prefs.insuranceAlerts ? <p>Ten probability {(insuranceResult.probability * 100).toFixed(2)}% · EV {signed(insuranceResult.ev, 4)} / insurance unit. Break-even: 33⅓%.</p> : <p>Evaluated from exact ten-value cards remaining, before the dealer check.</p>}</div></div><div className="signal-row"><div className="signal-icon"><ProgressRing percentage={stats.penetration} /></div><div><span className="metric-label">NEXT INDEX</span><strong>{deviation ? `This hand: TC ${signed(deviation.threshold)}` : deviationsSupported(rules, prefs.system, prefs.rounding, context) ? 'Hi-Lo indices ready' : 'Basic strategy only'}</strong><p>{deviation ? `Current TC ${tc === null ? '—' : signed(tc)}. ${ACTION_NAMES[deviation.action]}.` : 'Validated indices require 6 decks · S17 · peek · DAS · floor TC.'}</p></div></div></section></div>
        </>}
        <footer className="page-footer"><span><Icon name="shield" size={14} /> Free. Private. No session history.</span><div><button onClick={() => dialog.current?.showModal()}>Keyboard shortcuts</button><a href="https://wizardofodds.com/games/blackjack/strategy/calculator/" target="_blank" rel="noreferrer">Strategy reference ↗</a></div></footer>
      </main>
    </div>
    {tab === 'live' && <div className="mobile-livebar"><button onClick={() => scrollToCards('counter')}><span>COUNTER</span><strong>TC {tc === null ? '—' : signed(tc)} <i>· RC {countUncertain ? '—' : signed(stats.rc)}</i></strong></button><button onClick={() => scrollToCards('player')}><span>MY HAND <Icon name="arrow" size={12} /></span><strong>{waitingForPeek ? 'Wait for peek' : hand.bust ? 'Bust' : recommended ? ACTION_NAMES[recommended.action] : 'Enter your hand'}</strong></button></div>}
    <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-title"><div className="dialog-heading"><div><span className="eyebrow">MAKE IT YOUR TABLE</span><h2 id="settings-title">Rules & preferences</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div><TableSettings rules={rules} onRules={onRules} preferences={prefs} onPreferences={setPrefs} /><div className="dialog-footer"><span className="small muted">Changes apply instantly. Preferences clear on refresh.</span><button className="button primary" onClick={() => dialog.current?.close()}>Back to the table <Icon name="arrow" size={16} /></button></div></dialog>
  </div>;
}
