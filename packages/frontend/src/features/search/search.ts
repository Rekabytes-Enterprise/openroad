import { validPoint, type Destination } from '../map/types';
export type SearchPlace = Destination & { id: string };
export function parseSearchResults(value: unknown): SearchPlace[] {
  if (!value || typeof value !== 'object' || !('places' in value) || !Array.isArray(value.places) || value.places.length > 8) throw new Error('Invalid search response.');
  return value.places.map((place: unknown) => {
    if (!place || typeof place !== 'object' || !('id' in place) || typeof place.id !== 'string' || !('name' in place) || typeof place.name !== 'string' || !('detail' in place) || typeof place.detail !== 'string' || !('point' in place) || !validPoint(place.point)) throw new Error('Invalid search result.');
    return { id: place.id, name: place.name, detail: place.detail, point: place.point };
  });
}
