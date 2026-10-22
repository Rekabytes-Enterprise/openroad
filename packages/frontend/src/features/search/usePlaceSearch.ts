'use client';
import { useEffect, useState } from 'react';
import { parseSearchResults, type SearchPlace } from './search';
import type { Point } from '../map/types';
import { SearchCache } from './cache';
type SearchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; places: SearchPlace[] } | { kind: 'error'; message: string };
export function usePlaceSearch(query: string, open: boolean, online: boolean, proximity: Point | null) {
  const term = query.trim();
  const [cache] = useState(() => new SearchCache());
  const lat = proximity?.lat, lng = proximity?.lng;
  const key = JSON.stringify([term.toLocaleLowerCase(), lat ?? null, lng ?? null]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ term: string; state: SearchState }>({ term: '', state: { kind: 'idle' } });
  useEffect(() => {
    if (!open || term.length < 3) return;
    const cached = cache.get(key);
    if (cached) { setResult({ term: key, state: { kind: 'ready', places: cached } }); return; }
    if (!online) return;
    const controller = new AbortController();
    setResult({ term: key, state: { kind: 'loading' } });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/v1/places/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: term, proximity: lat === undefined || lng === undefined ? null : { lat, lng } }), cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
        if (!response.ok) throw new Error('Place search is unavailable. Try again.');
        const value: unknown = await response.json();
        const places = parseSearchResults(value);
        if (!controller.signal.aborted) { cache.set(key, places); setResult({ term: key, state: { kind: 'ready', places } }); }
      } catch {
        if (!controller.signal.aborted) setResult({ term: key, state: { kind: 'error', message: 'Place search is unavailable. Try again.' } });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term, key, lat, lng, open, online, attempt, cache]);
  const cachedPlaces = cache.get(key);
  const state: SearchState = !open || term.length < 3 ? { kind: 'idle' }
    : cachedPlaces ? { kind: 'ready', places: cachedPlaces }
    : !online ? { kind: 'error', message: 'Connect to the internet to search places.' }
    : result.term === key ? result.state : { kind: 'loading' };
  return { state, retry: () => setAttempt(value => value + 1) };
}
