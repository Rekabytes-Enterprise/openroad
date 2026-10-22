import type { SearchPlace } from './search';
// Per-tab memory only. Never store searches or user coordinates on disk.
export class SearchCache {
  private entries = new Map<string, { expires: number; places: SearchPlace[] }>();
  get(key: string, now = Date.now()): SearchPlace[] | undefined {
    const entry = this.entries.get(key);
    if (!entry) return;
    if (entry.expires <= now) { this.entries.delete(key); return; }
    return entry.places;
  }
  set(key: string, places: SearchPlace[], now = Date.now()) {
    for (const [id, entry] of this.entries) if (entry.expires <= now) this.entries.delete(id);
    this.entries.delete(key);
    this.entries.set(key, { expires: now + 300_000, places });
    while (this.entries.size > 50) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}
