export type Point = Readonly<{ lat: number; lng: number }>;
export type Destination = Readonly<{ point: Point; name: string; detail: string }>;
export type MapConfig = {
  styleUrl: string;
  nightStyleUrl: string;
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
  if (!('styleUrl' in value) || typeof value.styleUrl !== 'string'
    || !(value.styleUrl.startsWith('https://') || /^\/(?!\/)[^?#]+\.json$/.test(value.styleUrl))
    || !('attribution' in value) || typeof value.attribution !== 'string'
    || !('attributionUrl' in value) || typeof value.attributionUrl !== 'string' || !value.attributionUrl.startsWith('https://')
    || !('initialCenter' in value) || !validPoint(value.initialCenter)
    || !('maxZoom' in value) || typeof value.maxZoom !== 'number' || !Number.isInteger(value.maxZoom) || value.maxZoom < 1 || value.maxZoom > 22
    || !('initialZoom' in value) || typeof value.initialZoom !== 'number' || !Number.isInteger(value.initialZoom)
    || value.initialZoom < 1 || value.initialZoom > value.maxZoom) throw new Error('Map configuration is invalid.');
  const nightStyleUrl = 'nightStyleUrl' in value ? value.nightStyleUrl : value.styleUrl;
  if (typeof nightStyleUrl !== 'string' || !(nightStyleUrl.startsWith('https://') || /^\/(?!\/)[^?#]+\.json$/.test(nightStyleUrl))) throw new Error('Night map configuration is invalid.');
  return { nightStyleUrl, styleUrl: value.styleUrl, attribution: value.attribution, attributionUrl: value.attributionUrl,
    initialCenter: value.initialCenter, maxZoom: value.maxZoom, initialZoom: value.initialZoom };
}
