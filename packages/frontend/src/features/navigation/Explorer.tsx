'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDownToLine, ArrowRight, ChevronRight, Compass, ExternalLink, Info, LocateFixed, MapPin, Minus, Navigation2, Plus, WifiOff, X } from 'lucide-react';
import { LocationController, locationDiagnostic } from '../location/location';
import { parseMapConfig, type Destination, type MapConfig, type Point } from '../map/types';
import type { MapHandle } from '../map/MapView';
import { readRouteResponse, type RouteState } from '../routing/route';
import { useAppearance } from '../appearance/useAppearance';
import { usePlaceSearch } from '../search/usePlaceSearch';
import { progress, instruction, formatDistance, speedKmh } from './guidance';
import { ManeuverIcon } from './TurnGuidance';
import { usePwa } from '@/pwa/usePwa';

const MapView = dynamic(() => import('../map/MapView').then(module => module.MapView), { ssr: false, loading: () => <div className="map-loading"><Compass size={28} /><span>Loading the map…</span></div> });
const DriveMap = dynamic(() => import('../map/DriveMap').then(module => module.DriveMap), { ssr: false });
export function Explorer() {
  const [location] = useState(() => new LocationController(() => typeof navigator === 'undefined' ? undefined : navigator.geolocation));
  const locationState = useSyncExternalStore(location.subscribe, location.getSnapshot, location.getServerSnapshot);
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [configAttempt, setConfigAttempt] = useState(0);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [driving, setDriving] = useState(false);
  const [routeState, setRouteState] = useState<RouteState>({ kind: 'idle' });
  const requestRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchArea, setSearchArea] = useState<Point | null>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [follow, setFollow] = useState(true);
  const [dialog, setDialog] = useState<'about' | 'install' | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const map = useRef<MapHandle>(null);
  const pwa = usePwa();
  const fix = locationState.status === 'ready' ? locationState.fix : location.getLastFix();
  const search = usePlaceSearch(query, searchOpen, pwa.online, searchArea);
  const locating = locationState.status === 'requesting';
  const appearance = useAppearance(fix?.point ?? null);

  const guidance = useMemo(() => driving && routeState.kind === 'ready' && fix ? progress(routeState.route, fix.point) : null, [driving, routeState, fix]);
  const freshLocation = locationState.status === 'ready' && !locationState.stale;
  const gpsReady = freshLocation && fix !== null && fix.accuracy <= 50;
  const offRoute = !!guidance && guidance.away > 50;
  const preciseLocation = driving || destination !== null;
  useEffect(() => { location.setPrecise(preciseLocation); }, [location, preciseLocation]);
  const gpsDiagnostic = locationDiagnostic(locationState);

  // Runtime tile configuration is fetched once, independently from GPS permission.
  useEffect(() => {
    const controller = new AbortController();
    setConfigError('');
    void fetch('/map-config.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Map configuration could not load.');
      return response.json();
    }).then(value => setConfig(parseMapConfig(value))).catch(error => {
      if (!controller.signal.aborted) setConfigError(error instanceof Error ? error.message : 'Map configuration could not load.');
    });
    return () => controller.abort();
  }, [configAttempt]);

  useEffect(() => {
    // Start on entry; the browser still controls permission. Stop stays respected on resume.
    location.enable();
    if (document.hidden) location.pause();
    const onVisibility = () => { if (document.hidden) location.pause(); else location.resume(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); location.stop(); };
  }, [location]);

  useEffect(() => { if (dialog) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [dialog]);

  const clearRoute = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setDriving(false);
    setRouteState({ kind: 'idle' });
  }, []);
  useEffect(() => () => requestRef.current?.abort(), []);

  async function getRoute(fromLocation = false) {
    const start = locationState.status === 'ready' && !locationState.stale ? locationState.fix.point : null;
    if (!start || !destination) return;
    clearRoute();
    const controller = new AbortController();
    requestRef.current = controller;
    setFollow(false);
    setRouteState({ kind: 'loading' });
    try {
      const response = await fetch('/api/v1/routes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: start, destination: destination.point }), signal: controller.signal });
      const route = await readRouteResponse(response);
      if (!controller.signal.aborted) { setRouteState({ kind: 'ready', route }); if (fromLocation) { setDriving(true); setFollow(true); } }
    } catch (error) {
      if (!controller.signal.aborted) setRouteState({ kind: 'error', message: error instanceof Error ? error.message : 'Could not calculate a route.' });
    }
  }
  const selectPoint = useCallback((point: Point) => {
    clearRoute();
    setDestination({ point, name: 'Dropped pin', detail: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` });
    setFollow(false);
  }, [clearRoute]);
  const pauseFollow = useCallback(() => setFollow(false), []);

  function openSearch() {
    // One location snapshot per search session. GPS jitter must not cancel a search.
    if (!searchOpen) setSearchArea(fix?.point ?? null);
    setSearchOpen(true);
  }

  function closeSearch() {
    searchInput.current?.blur();
    setSearchOpen(false);
  }

  function selectPlace(place: Destination) {
    clearRoute();
    setDestination(place);
    closeSearch();
    setQuery('');
    setFollow(false);
    map.current?.center(place.point);
  }
  function locate() {
    setFollow(true);
    if (fix) map.current?.center(fix.point);
    location.enable();
  }
  async function install() {
    try { if (!(await pwa.install())) setDialog('install'); }
    catch { setDialog('install'); }
  }
  const locationLabel = locationState.status === 'ready'
    ? locationState.stale ? 'Waiting for a fresh location' : locationState.fix.accuracy > 50 ? 'Location accuracy is low' : 'Location is on'
    : locating ? 'Finding your location…' : locationState.status === 'paused' ? 'Location is paused' : 'Your location is off';

  return <main className="explorer" data-search-open={searchOpen} data-driving={driving}>
    <header className="drive-header">
      <a className="drive-brand" href="/" aria-label="OpenRoad home"><Navigation2 size={22} />openroad.</a>
      {driving ? <div className="turn-guidance" role="status"><ManeuverIcon step={guidance?.next} active={gpsReady && !offRoute} arrived={guidance?.arrived ?? false} /><div><strong>{!gpsReady ? gpsDiagnostic.title : offRoute ? 'You are off route' : guidance?.arrived ? 'You have arrived' : formatDistance(guidance?.toTurn ?? 0)}</strong><span>{!gpsReady ? gpsDiagnostic.detail : offRoute ? 'Recalculate when safe to do so.' : guidance?.arrived ? destination?.name : instruction(guidance?.next)}</span></div></div> : <div className="drive-search"><label htmlFor="place-search"><MapPin size={20} /><span className="sr-only">Search places</span></label><input ref={searchInput} id="place-search" type="search" inputMode="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={160} autoComplete="off" onKeyDown={event => { if (event.key === 'Escape') closeSearch(); if (event.key === 'Enter') event.currentTarget.blur(); }} placeholder="Where to?" value={query} onFocus={openSearch} onChange={event => { setQuery(event.target.value); openSearch(); }} /><button aria-label={searchOpen ? 'Close search' : 'About OpenRoad'} onClick={() => searchOpen ? closeSearch() : setDialog('about')}>{searchOpen ? <X size={20} /> : <Info size={20} />}</button></div>}
      {searchOpen && <section className="drive-results" aria-label="Place search results" aria-busy={search.state.kind === 'loading'}>
        <div role="status">{search.state.kind === 'idle' && <p>Type at least 3 characters. Add a city to narrow results.</p>}{search.state.kind === 'loading' && <p>Searching…</p>}{search.state.kind === 'ready' && search.state.places.length === 0 && <p>No places found. Try another name or drop a pin.</p>}</div>
        {search.state.kind === 'error' && <><p role="alert">{search.state.message}</p>{pwa.online && <button onClick={search.retry}>Try again</button>}</>}
        <div className="search-place-list">{(search.state.kind === 'ready' || search.state.kind === 'loading') && search.state.places.map(place => <button key={place.id} onClick={() => selectPlace(place)}><MapPin size={18} /><span>{place.name}<small>{place.detail}</small></span><ChevronRight size={18} /></button>)}</div>
        <p>{searchArea ? 'Within 5 km first · ' : ''}Search by Photon · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p>
      </section>}
    </header>
    <section className="map-region" aria-label="Map">
      {config ? driving && routeState.kind === 'ready' ? <DriveMap turnMeters={gpsReady && !offRoute ? guidance?.toTurn ?? null : null} remainingPoints={gpsReady && !offRoute ? guidance?.remainingPoints ?? null : null} ref={map} config={config} appearance={appearance} route={routeState.route} destination={destination} fix={fix} follow={follow} heading={gpsReady && !offRoute ? fix?.heading ?? guidance?.heading ?? null : null} onDrag={pauseFollow} /> : <MapView ref={map} config={config} appearance={appearance} driving={driving} heading={gpsReady && !offRoute ? fix?.heading ?? guidance?.heading ?? null : null} route={routeState.kind === 'ready' ? routeState.route : null} destination={destination} fix={fix} follow={follow} onSelect={driving ? () => {} : selectPoint} onDrag={pauseFollow} /> : <div className="map-loading"><Compass size={28} /><span>{configError || 'Loading the map…'}</span>{configError && <button onClick={() => setConfigAttempt(value => value + 1)}>Try again</button>}</div>}
      {!pwa.online && <div className="offline-banner" role="status"><WifiOff size={16} />You are offline. Unloaded map areas need a connection.</div>}
      {pwa.waiting && <div className="update-banner">An update is ready. <button onClick={() => { location.stop(); pwa.update(); }}>Refresh app</button></div>}
      <div className="map-center-crosshair" aria-hidden="true" />
      <div className="map-controls"><div className="zoom-controls"><button aria-label="Zoom in" onClick={() => map.current?.zoom(1)}><Plus size={21} /></button><button aria-label="Zoom out" onClick={() => map.current?.zoom(-1)}><Minus size={21} /></button></div><button className={`locate-control ${follow ? 'active' : ''}`} aria-label="Recenter on my location" onClick={locate} disabled={locating}><LocateFixed size={21} /></button>
      <button className="select-center" aria-label="Select map center" onClick={() => { const point = map.current?.getCenter(); if (point) selectPoint(point); }} disabled={!config}><MapPin size={20} /><span>Select map center</span></button></div>
      <div className="map-attribution"><a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a><span>·</span><a href="https://openmaptiles.org" target="_blank" rel="noreferrer">© OpenMapTiles</a><span>·</span>{config && <a href={config.attributionUrl} target="_blank" rel="noreferrer">{config.attribution}</a>}</div>
    </section>

    <section className="drive-sheet" aria-label="Driving route">
      {driving ? <div className="active-drive"><aside className="drive-speed" aria-label="Current speed"><strong>{speedKmh(fix?.speed, gpsReady) ?? '—'}</strong><span>km/h</span></aside><div><p className="drive-eyebrow">{follow ? 'DRIVING · HEADING UP' : 'MAP PAUSED'}</p><h1>{gpsReady && guidance && !offRoute ? guidance.arrived ? 'Arrived' : `${Math.max(1, Math.round(guidance.seconds / 60))} min · ${formatDistance(guidance.remaining)}` : 'Location guidance paused'}</h1><p className="drive-hint">{destination?.name}</p></div>{!follow && <button className="primary-button" onClick={locate}>Resume follow</button>}{gpsReady && offRoute && <button className="primary-button" disabled={!pwa.online} onClick={() => void getRoute(true)}>Recalculate route</button>}<button className="text-action" onClick={() => setDriving(false)}>End drive</button></div> : <>

      <div className="sheet-heading"><div><p className="drive-eyebrow">{routeState.kind === 'ready' ? 'ROUTE PREVIEW' : 'PLAN A DRIVE'}</p><h1>{destination?.name ?? 'Where to?'}</h1></div>{destination && <button aria-label="Clear destination" onClick={() => { clearRoute(); setDestination(null); }}><X size={20} /></button>}</div>
      {!destination && <p className="drive-hint">Search places or tap the map to choose a destination.</p>}
      <div className="drive-location"><span>{locationLabel}</span></div>
      {locationState.status === 'error' && <p className="location-error" role="alert">{locationState.message}</p>}
      {destination && routeState.kind !== 'ready' && <><div className="drive-route-actions"><button className="primary-button" disabled={!freshLocation || !pwa.online || routeState.kind === 'loading'} onClick={() => void getRoute()}>{routeState.kind === 'loading' ? 'Calculating…' : 'Preview route'}<ArrowRight size={18} /></button></div><p className="drive-disclosure">Route calculation shares both points with OSRM. No trip history saved.</p></>}
      {routeState.kind === 'ready' && <div className="drive-estimate" role="status"><strong>{Math.max(1, Math.round(routeState.route.durationSeconds / 60))} min <span>· {(routeState.route.distanceMeters / 1000).toFixed(1)} km</span></strong><small>Driving estimate · No live traffic</small></div>}
      {routeState.kind === 'ready' && <><button className="primary-button start-drive" disabled={!freshLocation} onClick={() => { closeSearch(); setDriving(true); setFollow(true); }}><Navigation2 size={22} strokeWidth={2.25} aria-hidden="true" /><span>Start drive</span></button>{!gpsReady && <p className="drive-disclosure">{gpsDiagnostic.detail}</p>}</>}
      {routeState.kind === 'error' && <p className="location-error" role="alert">{routeState.message}</p>}
      {!pwa.installed && <button className="drive-install" onClick={install}>Install OpenRoad</button>}
      </>}
    </section>

    <dialog ref={dialogRef} className="app-dialog" onCancel={() => setDialog(null)} onClick={event => { if (event.target === event.currentTarget) setDialog(null); }} aria-labelledby="dialog-title"><button className="dialog-close" aria-label="Close dialog" onClick={() => setDialog(null)}><X size={20} /></button><span className="dialog-icon">{dialog === 'install' ? <ArrowDownToLine size={26} /> : <Compass size={26} />}</span><h2 id="dialog-title">{dialog === 'install' ? 'Keep OpenRoad on your home screen' : 'A map built on open data'}</h2>{dialog === 'install' ? <><p>On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen.</p><p>On Android or desktop, use your browser menu and choose Install app or Add to Home Screen when available.</p><p className="dialog-note">The app can open offline after your first visit. Map tiles still need a connection.</p></> : <><p>OpenRoad uses OpenStreetMap data, OpenFreeMap vector tiles, Leaflet and MapLibre. Choose a place on the map and use your device location to find your bearings.</p><p>Location is optional. Nearby search sends your location to our backend and Photon service to prioritize matches within 5 km. Recent searches are cached in memory for five minutes and cleared when you reload. We do not save a location history. Day and night appearance follows local sunrise and sunset when location is available, otherwise your device appearance. The map provider receives requests for the areas you view.</p><p className="dialog-note">Driving route previews use OSRM. Estimates do not include live traffic. Start Drive shows visual turn instructions while the app is open. Voice guidance and automatic rerouting are not available.</p><a className="dialog-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap attribution <ExternalLink size={14} /></a><a className="dialog-link" href="/licenses/positron.md" target="_blank" rel="noreferrer">Positron style credits and license <ExternalLink size={14} /></a></>}</dialog>
    <div className="sr-only" aria-live="polite">{destination ? `${destination.name} selected as destination.` : ''}</div>
  </main>;
}
