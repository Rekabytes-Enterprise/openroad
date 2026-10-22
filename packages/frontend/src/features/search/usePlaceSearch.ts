'use client';
import { useEffect, useState } from 'react';
import { parseSearchResults, type SearchPlace } from './search';
type SearchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; places: SearchPlace[] } | { kind: 'error'; message: string };
export function usePlaceSearch(query: string, open: boolean, online: boolean) {
  const term = query.trim();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ term: string; state: SearchState }>({ term: '', state: { kind: 'idle' } });
  useEffect(() => {
    if (!open || !online || term.length < 3) return;
    const controller = new AbortController();
    setResult({ term, state: { kind: 'loading' } });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/places/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: term }), cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        if (!response.ok) throw new Error('Place search is unavailable. Try again.');
        const value: unknown = await response.json();
        const places = parseSearchResults(value);
        if (!controller.signal.aborted) setResult({ term, state: { kind: 'ready', places } });
      } catch {
        if (!controller.signal.aborted) setResult({ term, state: { kind: 'error', message: 'Place search is unavailable. Try again.' } });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, open, online, attempt]);
  const state: SearchState = !open || term.length < 3 ? { kind: 'idle' }
    : !online ? { kind: 'error', message: 'Connect to the internet to search places.' }
    : result.term === term ? result.state : { kind: 'loading' };
  return { state, retry: () => setAttempt(value => value + 1) };
}
