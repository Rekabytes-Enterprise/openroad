export type Point = Readonly<{ lat: number; lng: number }>;
export type Destination = Readonly<{ point: Point; name: string; detail: string }>;
export type MapConfig = {
  tileUrl: string;
  attribution: string;
  attributionUrl: string;
  maxZoom: number;
  initialCenter: Point;
  initialZoom: number;
};

export function validPoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object' || !('lat' in value) || !('lng' in value)) return false;
  return typeof value.lat === 'number' && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90
    && typeof value.lng === 'number' && Number.isFinite(value.lng) && Math.abs(value.lng) <= 180;
}

export function parseMapConfig(value: unknown): MapConfig {
  if (!value || typeof value !== 'object') throw new Error('Map configuration is unavailable.');
  const config = value as Record<string, unknown>;
  if (typeof config.tileUrl !== 'string' || !config.tileUrl.startsWith('https://')
    || !['{z}', '{x}', '{y}'].every(part => String(config.tileUrl).includes(part))
    || typeof config.attribution !== 'string' || typeof config.attributionUrl !== 'string'
    || !config.attributionUrl.startsWith('https://') || !validPoint(config.initialCenter)
    || typeof config.maxZoom !== 'number' || !Number.isInteger(config.maxZoom) || config.maxZoom < 1 || config.maxZoom > 22
    || typeof config.initialZoom !== 'number' || !Number.isInteger(config.initialZoom)
    || config.initialZoom < 1 || config.initialZoom > config.maxZoom) throw new Error('Map configuration is invalid.');
  return config as MapConfig;
}
