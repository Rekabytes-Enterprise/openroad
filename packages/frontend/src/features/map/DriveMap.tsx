'use client';

import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Map, Marker, type GeoJSONSource } from 'maplibre-gl';
import { drivingAnchor, drivingZoom } from './drivingCamera';
import type { MapHandle } from './MapView';
import type { Destination, MapConfig, Point } from './types';
import type { DrivingRoute } from '../routing/route';
import type { Fix } from '../location/location';
import type { Appearance } from '../appearance/solar';

type Props = {
  config: MapConfig; appearance: Appearance; route: DrivingRoute;
  destination: Destination | null; fix: Fix | null; follow: boolean;
  turnMeters: number | null; remainingPoints: Point[] | null; heading: number | null; onDrag: () => void;
};
export const routeData = (points: Point[]): GeoJSON.FeatureCollection<GeoJSON.LineString> => ({ type: 'FeatureCollection', features: points.length < 2 ? [] : [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map(p => [p.lng, p.lat]) } }] });

/** The driving renderer owns both camera and overlays, so bearing rotates them together. */
export const DriveMap = memo(forwardRef<MapHandle, Props>(function DriveMap(props, ref) {
  const { config, appearance, route, destination, fix, follow, heading, remainingPoints } = props;
  const style = appearance === 'dark' ? config.nightStyleUrl : config.styleUrl;
  const renderedStyle = useRef(style);
  const latest = useRef(props);
  latest.current = props;
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const vehicle = useRef<Marker | null>(null);
  const manualZoom = useRef<number | null>(null);
  const manualCamera = useRef(false);
  const updateCamera = useRef<() => void>(() => {});
  const visibleRoute = useRef({ route, points: remainingPoints ?? route.points });
  const [tileError, setTileError] = useState(false);
  useImperativeHandle(ref, () => ({
    zoom: delta => { const m = map.current; if (m) { manualZoom.current = m.getZoom() + delta; updateCamera.current(); if (!latest.current.follow) m.setZoom(manualZoom.current); } },
    center: (_point: Point) => { manualZoom.current = null; manualCamera.current = false; updateCamera.current(); },
    getCenter: () => { const p = map.current?.getCenter(); return p ? { lat: p.lat, lng: p.lng } : undefined; },
    retry: () => { setTileError(false); map.current?.setStyle(style); },
  }), [style]);

  useEffect(() => {
    if (!container.current) return;
    const initial = latest.current;
    const point = initial.fix?.point ?? initial.route.points[0];
    const m = new Map({ container: container.current, style: initial.appearance === 'dark' ? config.nightStyleUrl : config.styleUrl, center: [point.lng, point.lat], zoom: drivingZoom(initial.fix?.speed, initial.turnMeters), bearing: initial.heading ?? 0, pitch: 0, attributionControl: false, maxPitch: 0, minZoom: 3, maxZoom: config.maxZoom - 1 });
    map.current = m;
    renderedStyle.current = initial.appearance === 'dark' ? config.nightStyleUrl : config.styleUrl;
    m.dragRotate.enable();
    m.touchZoomRotate.enableRotation();
    m.touchPitch.disable();
    const pauseCamera = () => { manualCamera.current = true; latest.current.onDrag(); };
    m.on('dragstart', pauseCamera);
    m.on('rotatestart', event => {
      // Camera updates also emit rotate events; only a user gesture pauses follow.
      if (event.originalEvent) pauseCamera();
    });
    m.on('error', () => setTileError(true));
    m.on('style.load', () => {
      m.addSource('drive-route', { type: 'geojson', data: routeData(visibleRoute.current.points) });
      m.addLayer({ id: 'drive-route-outline', type: 'line', source: 'drive-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 10 } });
      m.addLayer({ id: 'drive-route-line', type: 'line', source: 'drive-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#3056ee', 'line-width': 6 } });
    });
    const root = container.current.closest('.explorer');
    const header = root?.querySelector('.drive-header');
    const sheet = root?.querySelector('.drive-sheet');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let layout = { width: 0, height: 0, anchor: drivingAnchor(0, 0, 0, 0) };
    const measure = () => {
      if (!container.current) return;
      const bounds = container.current.getBoundingClientRect();
      const headerBox = header?.getBoundingClientRect();
      const sheetBox = sheet?.getBoundingClientRect();
      const mobile = bounds.width <= 760;
      const top = mobile && headerBox ? Math.max(0, headerBox.bottom - bounds.top) : 24;
      const bottom = mobile && sheetBox ? Math.max(0, bounds.bottom - sheetBox.top) : 24;
      const left = !mobile ? Math.max(headerBox?.right ?? 0, sheetBox?.right ?? 0) - bounds.left + 24 : 0;
      // Panel changes affect the camera anchor, not the WebGL canvas size.
      if (layout.width !== bounds.width || layout.height !== bounds.height) m.resize();
      layout = { width: bounds.width, height: bounds.height, anchor: drivingAnchor(bounds.width, bounds.height, top, bottom, left) };
      if (root instanceof HTMLElement && headerBox) root.style.setProperty('--drive-header-bottom', `${headerBox.bottom - bounds.top}px`);
    };
    measure();
    updateCamera.current = () => {
      const current = latest.current;
      if (manualCamera.current || !current.follow || !current.fix) return;
      // Interpolate GPS camera changes instead of snapping on every fix.
      m.easeTo({ center: [current.fix.point.lng, current.fix.point.lat], zoom: Math.min(config.maxZoom - 1, manualZoom.current ?? drivingZoom(current.heading === null ? null : current.fix.speed, current.turnMeters)), ...(current.heading === null ? {} : { bearing: current.heading }), offset: [layout.anchor[0] - layout.width / 2, layout.anchor[1] - layout.height / 2], duration: reducedMotion.matches ? 0 : 350 });
    };
    const observer = new ResizeObserver(() => { measure(); updateCamera.current(); });
    observer.observe(container.current);
    if (header) observer.observe(header);
    if (sheet) observer.observe(sheet);
    return () => { observer.disconnect(); if (root instanceof HTMLElement) root.style.removeProperty('--drive-header-bottom'); vehicle.current?.remove(); vehicle.current = null; updateCamera.current = () => {}; m.remove(); map.current = null; };
  }, [config]);

  useEffect(() => {
    const m = map.current;
    if (!m || renderedStyle.current === style) return;
    renderedStyle.current = style;
    setTileError(false);
    m.setStyle(style);
  }, [style]);
  useEffect(() => {
    if (visibleRoute.current.route !== route) visibleRoute.current = { route, points: route.points };
    if (remainingPoints !== null) visibleRoute.current.points = remainingPoints;
    map.current?.getSource<GeoJSONSource>('drive-route')?.setData(routeData(visibleRoute.current.points));
  }, [route, remainingPoints]);
  useEffect(() => {
    const m = map.current;
    if (!m || !destination) return;
    const marker = new Marker({ color: '#3056ee' }).setLngLat([destination.point.lng, destination.point.lat]).addTo(m);
    return () => { marker.remove(); };
  }, [destination]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!fix) { vehicle.current?.remove(); vehicle.current = null; return; }
    if (!vehicle.current) {
      const element = document.createElement('div');
      element.className = 'driving-marker';
      element.setAttribute('aria-label', 'Your driving direction');
      element.innerHTML = '<svg viewBox="0 0 40 40"><path d="M20 3 L34 34 L20 28 L6 34 Z" fill="#3056ee" stroke="white" stroke-width="3"/></svg>';
      vehicle.current = new Marker({ element, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([fix.point.lng, fix.point.lat]).addTo(m);
    }
    vehicle.current.setLngLat([fix.point.lng, fix.point.lat]);
    // Unknown heading keeps the last camera bearing and shows a location dot.
    vehicle.current.getElement().classList.toggle('heading-unknown', heading === null);
    vehicle.current.setRotation(heading ?? m.getBearing());
    if (follow) updateCamera.current();
  }, [fix, follow, heading]);

  return <><div ref={container} className="map-canvas drive-map" aria-label="Driving map. Drag to pan or twist with two fingers to rotate. Resume follow restores your direction of travel." />{tileError && <div className="tile-error" role="status">Some map tiles could not load. <button onClick={() => { setTileError(false); map.current?.setStyle(style); }}>Retry</button></div>}</>;
}));
