'use client';
import { useEffect, useMemo, useState } from 'react';
import type { EVResult } from '@/lib/blackjack/ev';
import type { Composition, HandContext, Rank, Rules } from '@/lib/blackjack/model';
export function useHandEV(shoe: Composition, cards: Rank[], dealer: Rank | undefined, rules: Rules, context: HandContext, enabled: boolean) {
  const [response, setResponse] = useState<{ key: string; value: EVResult } | null>(null);
  const key = useMemo(() => JSON.stringify({ shoe, cards, dealer, rules, context }), [shoe, cards, dealer, rules, context]);
  useEffect(() => {
    if (!enabled || !dealer || cards.length < 2) return;
    let worker: Worker | undefined;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      try {
        worker = new Worker(new URL('../lib/blackjack/ev.worker.ts', import.meta.url));
        worker.onmessage = event => { if (!cancelled) setResponse({ key, value: event.data }); };
        worker.onerror = () => { if (!cancelled) setResponse({ key, value: { values: {}, unavailable: {}, nodes: 0, model: '', error: 'EV calculation is unavailable in this browser.' } }); };
        worker.postMessage({ shoe, cards, dealer, rules, context });
      } catch { if (!cancelled) setResponse({ key, value: { values: {}, unavailable: {}, nodes: 0, model: '', error: 'Web Workers are required to calculate EV.' } }); }
    }, 160);
    return () => { cancelled = true; window.clearTimeout(timer); worker?.terminate(); };
  }, [key, shoe, cards, dealer, rules, context, enabled]);
  return response?.key === key ? response.value : null;
}
