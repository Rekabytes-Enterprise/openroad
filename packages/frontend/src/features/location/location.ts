import type { Point } from '../map/types';

export type Fix = { point: Point; accuracy: number; timestamp: number; speed?: number | null; heading?: number | null };
export type LocationState =
  | { status: 'idle' | 'paused' }
  | { status: 'requesting'; message: string }
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
  private driving = false;
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
    this.update({ status: 'requesting', message: 'Waiting for your device to report a location.' });
    const generation = ++this.generation;
    try {
      this.watcher = source.watchPosition(position => {
        if (generation !== this.generation) return;
        const fix = { point: { lat: position.coords.latitude, lng: position.coords.longitude }, accuracy: position.coords.accuracy, timestamp: position.timestamp, speed: typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed) && position.coords.speed >= 0 ? position.coords.speed : null, heading: typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading) ? position.coords.heading : null };
        clearTimeout(this.expiry);
        this.update({ status: 'ready', fix, stale: Date.now() - fix.timestamp > 15000 });
        this.expiry = setTimeout(() => {
          if (generation === this.generation) this.update({ status: 'ready', fix, stale: true });
        }, Math.max(0, 15000 - (Date.now() - fix.timestamp)));
      }, error => {
        if (generation !== this.generation) return;
        if (error.code !== 1) {
          // Timeout and unavailable are transient; the browser watch can recover.
          if (this.state.status === 'ready') {
            this.update({ ...this.state, stale: true });
          } else {
            this.update({ status: 'requesting', message: error.code === 3
              ? 'Your device has not returned a location yet. Still listening. Check device Location Services, or stop and retry.'
              : 'Your device cannot determine its location right now. Still listening. Check device Location Services.' });
          }
          return;
        }
        this.clear();
        this.enabled = false;
        this.update({ status: 'error', message: 'Location access is blocked. Allow it in your browser settings, or choose a place on the map.' });
      }, { enableHighAccuracy: this.driving, timeout: 30000, maximumAge: this.driving ? 0 : 10000 });
    } catch {
      this.clear();
      this.enabled = false;
      this.update({ status: 'error', message: 'Location could not start. Open the app over HTTPS and check your browser permissions.' });
    }
  };
  setDriving = (driving: boolean) => {
    if (this.driving === driving) return;
    this.driving = driving;
    if (this.watcher !== null) { this.clear(); this.enable(); }
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
