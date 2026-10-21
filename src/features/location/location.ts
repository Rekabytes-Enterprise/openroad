import type { Point } from '../map/types';

export type Fix = { point: Point; accuracy: number; timestamp: number };
export type LocationState =
  | { status: 'idle' | 'requesting' | 'paused' }
  | { status: 'ready'; fix: Fix; stale: boolean }
  | { status: 'error'; message: string };

type Source = Pick<Geolocation, 'watchPosition' | 'clearWatch'>;
export const initialLocation: LocationState = { status: 'idle' };

/** Owns one GPS subscription. Coordinates never leave session memory. */
export class LocationController {
  private state: LocationState = initialLocation;
  private listeners = new Set<() => void>();
  private watcher: number | null = null;
  private generation = 0;
  private enabled = false;
  private source: Source | undefined;
  private expiry: ReturnType<typeof setTimeout> | undefined;

  constructor(private getSource: () => Source | undefined) {}

  getSnapshot = () => this.state;
  getServerSnapshot = () => initialLocation;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(state: LocationState) {
    this.state = state;
    this.listeners.forEach(listener => listener());
  }
  private clear() {
    this.generation++;
    if (this.watcher !== null) this.source?.clearWatch(this.watcher);
    this.watcher = null;
    clearTimeout(this.expiry);
  }
  enable = () => {
    if (this.watcher !== null) return;
    const source = this.getSource();
    if (!source) {
      this.update({ status: 'error', message: 'Location is unavailable in this browser. You can still choose a place on the map.' });
      return;
    }
    this.source = source;
    this.enabled = true;
    this.update({ status: 'requesting' });
    const generation = ++this.generation;
    try {
      this.watcher = source.watchPosition(position => {
        if (generation !== this.generation) return;
        const fix = { point: { lat: position.coords.latitude, lng: position.coords.longitude }, accuracy: position.coords.accuracy, timestamp: position.timestamp };
        clearTimeout(this.expiry);
        this.update({ status: 'ready', fix, stale: Date.now() - fix.timestamp > 15000 });
        this.expiry = setTimeout(() => {
          if (generation === this.generation) this.update({ status: 'ready', fix, stale: true });
        }, Math.max(0, 15000 - (Date.now() - fix.timestamp)));
      }, error => {
        if (generation !== this.generation) return;
        this.clear();
        this.enabled = false;
        const message = error.code === 1
          ? 'Location access is blocked. Allow it in your browser settings, or choose a place on the map.'
          : error.code === 3 ? 'Your location took too long to arrive. Try again outdoors.'
          : 'Your location is unavailable. Try again, or choose a place on the map.';
        this.update({ status: 'error', message });
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch {
      this.clear();
      this.enabled = false;
      this.update({ status: 'error', message: 'Location could not start. Open the app over HTTPS and check your browser permissions.' });
    }
  };
  pause = () => {
    this.clear();
    if (this.enabled) this.update({ status: 'paused' });
  };
  resume = () => { if (this.enabled) this.enable(); };
  stop = () => {
    this.enabled = false;
    this.clear();
    this.update(initialLocation);
  };
}
