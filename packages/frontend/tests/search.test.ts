import { describe, it, expect } from 'vitest';
import { parseSearchResults } from '../src/features/search/search';
describe('search response boundary', () => {
  const place = { id: 'osm:N:1', name: 'KLCC', detail: 'Kuala Lumpur', point: { lat: 3.15, lng: 101.71 } };
  it('preserves destination coordinates and handles no matches', () => {
    expect(parseSearchResults({ places: [place] })).toEqual([place]);
    expect(parseSearchResults({ places: [] })).toEqual([]);
  });
  it('rejects proxy pages, malformed points and oversized result lists', () => {
    for (const value of ['<html>', {}, { places: [{ ...place, point: { lat: 999, lng: 0 } }] }, { places: Array(9).fill(place) }]) expect(() => parseSearchResults(value)).toThrow();
  });
});
