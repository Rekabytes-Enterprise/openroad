'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import '@maplibre/maplibre-gl-leaflet';
import type { Destination, MapConfig, Point } from './types';
import type { DrivingRoute } from '../routing/route';
import type { Fix } from '../location/location';

export type MapHandle = { zoom: (delta: number) => void; center: (point: Point) => void; getCenter: () => Point | undefined; retry: () => void };
type Props = {
  config: MapConfig;
  route: DrivingRoute | null;
  destination: Destination | null;
  fix: Fix | null;
  follow: boolean;
  onSelect: (point: Point) => void;
  onDrag: () => void;
};

const pin = L.divIcon({ className: 'destination-marker', html: '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>', iconSize: [42, 48], iconAnchor: [21, 48] });

export const MapView = forwardRef<MapHandle, Props>(function MapView({ config, route, destination, fix, follow, onSelect, onDrag }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.MaplibreGL | null>(null);
  const destinationMarker = useRef<L.Marker | null>(null);
  const locationMarker = useRef<L.CircleMarker | null>(null);
  const accuracyCircle = useRef<L.Circle | null>(null);
  const callbacks = useRef({ onSelect, onDrag });
  const [tileError, setTileError] = useState(false);
  useEffect(() => { callbacks.current = { onSelect, onDrag }; }, [onSelect, onDrag]);

  useImperativeHandle(ref, () => ({
    zoom: delta => { map.current?.setZoom((map.current?.getZoom() ?? 14) + delta); },
    center: point => { map.current?.setView([point.lat, point.lng], Math.max(map.current.getZoom(), 15)); },
    getCenter: () => { const center = map.current?.getCenter(); return center ? { lat: center.lat, lng: center.lng } : undefined; },
    retry: () => { setTileError(false); tiles.current?.getMaplibreMap().setStyle(config.styleUrl, { diff: false }); },
  }), [config.styleUrl]);

  // Leaflet owns an external DOM tree and event listeners; dispose it on unmount.
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { zoomControl: false, attributionControl: false, minZoom: 3, maxZoom: config.maxZoom, zoomAnimation: false });
    instance.setView([config.initialCenter.lat, config.initialCenter.lng], config.initialZoom);
    map.current = instance;
    tiles.current = L.maplibreGL({ style: config.styleUrl, attributionControl: false }).addTo(instance);
    tiles.current.getMaplibreMap().on('error', () => setTileError(true));
    instance.on('click', (event: L.LeafletMouseEvent) => callbacks.current.onSelect({ lat: event.latlng.lat, lng: event.latlng.lng }));
    instance.on('dragstart', () => callbacks.current.onDrag());
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; tiles.current = null; destinationMarker.current = null; locationMarker.current = null; accuracyCircle.current = null; };
  }, [config]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    destinationMarker.current?.remove();
    destinationMarker.current = null;
    if (destination) {
      destinationMarker.current = L.marker([destination.point.lat, destination.point.lng], { icon: pin, title: destination.name, keyboard: false }).addTo(instance);
    }
  }, [destination]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    locationMarker.current?.remove();
    accuracyCircle.current?.remove();
    if (!fix) return;
    const center: L.LatLngTuple = [fix.point.lat, fix.point.lng];
    accuracyCircle.current = L.circle(center, { radius: fix.accuracy, color: '#3666ef', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(instance);
    locationMarker.current = L.circleMarker(center, { radius: 8, fillColor: '#3666ef', color: '#ffffff', weight: 3, fillOpacity: 1, interactive: false }).addTo(instance);
    if (follow) instance.panTo(center, { animate: false });
  }, [fix, follow]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !route) return;
    const line = L.polyline(route.points.map(point => [point.lat, point.lng]), { color: '#3056ee', weight: 6, opacity: 0.85, interactive: false }).addTo(instance);
    const first = route.points[0];
    const start = L.circleMarker([first.lat, first.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#16244d', fillOpacity: 1, interactive: false }).addTo(instance);
    const size = instance.getSize();
    const mobile = size.x <= 760;
    instance.fitBounds(line.getBounds(), { paddingTopLeft: mobile ? [35, 120] : [400, 100], paddingBottomRight: mobile ? [55, Math.round(size.y * 0.43) + 35] : [60, 60], maxZoom: 16 });
    return () => { line.remove(); start.remove(); };
  }, [route, config]);

  return <><div className="map-canvas" ref={container} aria-label="Interactive map. Use the arrow keys to pan and the Select map center button to choose a destination." />{tileError && <div className="tile-error" role="status">Some map tiles could not load. <button onClick={() => { setTileError(false); tiles.current?.getMaplibreMap().setStyle(config.styleUrl, { diff: false }); }}>Retry</button></div>}</>;
});
