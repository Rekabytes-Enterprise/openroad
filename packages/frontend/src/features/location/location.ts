import { validPoint, type Point } from '../map/types';

export type Fix = { point: Point; accuracy: number; timestamp: number; speed?: number | null; heading?: number | null };
export type LocationState =
  | { status: 'idle' | 'paused' }
  | { status: 'requesting'; message: string }
  | { status: 'ready'; fix: Fix; stale: boolean; ageSeconds?: number; issue?: string }
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
  private lastFix: Fix | null = null;
  private monitor: ReturnType<typeof setInterval> | undefined;
  private startedAt = 0;
  private attempts = 0;
  getLastFix = () => this.lastFix;
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
    clearInterval(this.monitor);
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
    if (this.lastFix) this.update({ status: 'ready', fix: this.lastFix, stale: true });
    else this.update({ status: 'requesting', message: 'Waiting for your device to report a location.' });
    this.startedAt = Date.now();
    const generation = ++this.generation;
    try {
      this.watcher = source.watchPosition(position => {
        if (generation !== this.generation) return;
        const fix = { point: { lat: position.coords.latitude, lng: position.coords.longitude }, accuracy: position.coords.accuracy, timestamp: position.timestamp, speed: typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed) && position.coords.speed >= 0 ? position.coords.speed : null, heading: typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading) ? position.coords.heading : null };
        if (!validPoint(fix.point) || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || !Number.isFinite(fix.timestamp) || fix.timestamp > Date.now() + 1000 || (this.lastFix && fix.timestamp < this.lastFix.timestamp)) return;
        this.lastFix = fix;
        if (Date.now() - fix.timestamp < 15000) this.attempts = 0;
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
            this.update({ ...this.state, stale: true, issue: error.code === 3 ? 'Location request timed out. Still listening.' : 'Location is temporarily unavailable. Still listening.' });
          } else {
            this.update({ status: 'requesting', message: error.code === 3
              ? 'Your device has not returned a location yet. Still listening. Reconnecting automatically.'
              : 'Your device cannot determine its location right now. Still listening. Reconnecting automatically.' });
          }
          return;
        }
        this.clear();
        this.enabled = false;
        this.update({ status: 'error', message: 'Location access is blocked. Allow it in your browser settings, or choose a place on the map.' });
      }, { enableHighAccuracy: this.driving, timeout: 30000, maximumAge: this.driving ? 0 : 10000 });
      this.monitor = setInterval(() => {
        if (generation !== this.generation) return;
        if (this.state.status === 'ready') {
          const ageSeconds = Math.max(0, Math.floor((Date.now() - this.state.fix.timestamp) / 1000));
          this.update({ ...this.state, ageSeconds, stale: this.state.stale || ageSeconds >= 15 });
        }
        // Restart stalled acquisition with capped backoff. Current coarse fixes keep listening.
        const lastUpdate = Math.max(this.startedAt, this.lastFix?.timestamp ?? 0);
        if (Date.now() - lastUpdate >= 45000 * 2 ** this.attempts) {
          this.attempts = Math.min(2, this.attempts + 1);
          this.clear();
          this.enable();
        }
      }, 1000);
    } catch {
      this.clear();
      this.enabled = false;
      this.update({ status: 'error', message: 'Location could not start. Open the app over HTTPS and check your browser permissions.' });
    }
  };
  setPrecise = (driving: boolean) => {
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
    this.lastFix = null;
    this.attempts = 0;
    this.update(initialLocation);
  };
}

export function locationDiagnostic(state: LocationState): { title: string; detail: string } {
  if (state.status === 'error') return { title: 'Location unavailable', detail: state.message };
  if (state.status === 'paused') return { title: 'Location paused', detail: 'Return to the app to resume location updates.' };
  if (state.status === 'ready') {
    const accuracy = Math.round(state.fix.accuracy);
    const age = state.ageSeconds ?? Math.max(0, Math.floor((Date.now() - state.fix.timestamp) / 1000));
    if (state.stale) return { title: 'Waiting for a location update', detail: `Last update ${age}s ago · Reported accuracy ±${accuracy} m. ${state.issue ?? 'Keeping your last position while reconnecting.'}` };
    if (state.fix.accuracy > 50) return { title: 'Location accuracy is low', detail: `Reported accuracy ±${accuracy} m · Updated ${age}s ago. Precise turns need 50 m or better. Check precise location permission and try an open area.` };
    return { title: 'Location is ready', detail: `Reported accuracy ±${accuracy} m · Updated ${age}s ago` };
  }
  return { title: 'Finding your location', detail: state.status === 'requesting' ? state.message : 'Allow location access to start guidance.' };
}
