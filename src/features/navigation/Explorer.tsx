'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDownToLine, ArrowRight, Check, ChevronRight, Compass, Crosshair, ExternalLink, Flag, Info, Landmark, LocateFixed, MapPin, Minus, Navigation2, Plus, ShieldCheck, Trees, WifiOff, X } from 'lucide-react';
import { LocationController } from '../location/location';
import { parseMapConfig, type Destination, type MapConfig, type Point } from '../map/types';
import type { MapHandle } from '../map/MapView';
import { usePwa } from '@/pwa/usePwa';

const MapView = dynamic(() => import('../map/MapView').then(module => module.MapView), { ssr: false, loading: () => <div className="map-loading"><Compass size={28} /><span>Loading the map…</span></div> });
const places: Destination[] = [
  { name: 'KLCC Park', detail: 'Park · Kuala Lumpur City Centre', point: { lat: 3.1550, lng: 101.7130 } },
  { name: 'Merdeka Square', detail: 'Landmark · City centre', point: { lat: 3.1486, lng: 101.6935 } },
  { name: 'Central Market', detail: 'Market · Jalan Hang Kasturi', point: { lat: 3.1425, lng: 101.6953 } },
];

export function Explorer() {
  const [location] = useState(() => new LocationController(() => typeof navigator === 'undefined' ? undefined : navigator.geolocation));
  const locationState = useSyncExternalStore(location.subscribe, location.getSnapshot, location.getServerSnapshot);
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [configAttempt, setConfigAttempt] = useState(0);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [follow, setFollow] = useState(false);
  const [dialog, setDialog] = useState<'about' | 'install' | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const map = useRef<MapHandle>(null);
  const pwa = usePwa();
  const fix = locationState.status === 'ready' ? locationState.fix : null;
  const locating = locationState.status === 'requesting';
  const tracking = locationState.status === 'ready' || locating || locationState.status === 'paused';

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
    const onVisibility = () => { if (document.hidden) location.pause(); else location.resume(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); location.stop(); };
  }, [location]);

  useEffect(() => { if (dialog) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [dialog]);

  const selectPoint = useCallback((point: Point) => {
    setDestination({ point, name: 'Dropped pin', detail: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` });
    setFollow(false);
  }, []);
  const pauseFollow = useCallback(() => setFollow(false), []);

  function selectPlace(place: Destination) {
    setDestination(place);
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

  return <main className="explorer">
    <aside className="sidebar" aria-label="Explore places">
      <header className="brand-row"><a href="/" className="brand" aria-label="OpenRoad home"><span className="brand-mark"><Navigation2 size={24} fill="currentColor" strokeWidth={1.5} /></span><span>openroad<span className="brand-dot">.</span></span></a><span className="beta-tag">EARLY ACCESS</span></header>
      <div className="sidebar-body">
        <div className="section-kicker"><span className="green-dot" /> GO EXPLORE</div>
        <h1>Where are<br className="desktop-break" /> we headed?</h1>
        <p className="intro">Choose a place on the map,<br />or explore a spot below.</p>

        <section className={`location-card ${fix ? 'is-located' : ''}`} aria-label="Your location">
          <div className="location-heading"><span className="location-icon"><LocateFixed size={19} /></span><div><strong>{locationLabel}</strong><p>{fix ? `Accuracy within ${Math.round(fix.accuracy)} m` : 'Enable it to find yourself on the map.'}</p></div></div>
          {locationState.status === 'error' && <p className="location-error" role="alert">{locationState.message}</p>}
          <div className="location-actions"><button className="primary-button" onClick={locate} disabled={locating}><LocateFixed size={16} />{locating ? 'Finding you…' : fix ? 'Recenter on me' : 'Use my location'}<ArrowRight size={17} /></button>{tracking && <button className="stop-button" onClick={() => { location.stop(); setFollow(false); }}>Stop</button>}</div>
          <span className="privacy-line"><ShieldCheck size={12} /> Your location stays in this session.</span>
        </section>

        <section className="places-section" aria-label="Places to explore">
          <div className="section-heading"><h2>Around Kuala Lumpur</h2><span>3 places</span></div>
          <div className="places-list">{places.map((place, index) => <button className={`place-card ${destination?.name === place.name ? 'selected' : ''}`} key={place.name} onClick={() => selectPlace(place)} aria-pressed={destination?.name === place.name}>
            <span className={`place-icon place-icon-${index}`}>{index === 0 ? <Trees size={22} /> : index === 1 ? <Flag size={22} /> : <Landmark size={22} />}</span><span className="place-copy"><strong>{place.name}</strong><span>{place.detail}</span></span><ChevronRight className="place-chevron" size={17} />
          </button>)}</div>
        </section>
        <div className="map-tip"><MapPin size={17} /><p>Somewhere else in mind?<br /><strong>Tap anywhere on the map.</strong></p></div>
        <div className="sidebar-spacer" />
        <button className="install-card" onClick={install}><span className="install-symbol"><ArrowDownToLine size={20} /></span><span><strong>{pwa.installed ? 'OpenRoad is installed' : 'Take the map with you'}</strong><span>{pwa.installed ? 'Ready on your home screen' : 'Add OpenRoad to your home screen'}</span></span><ChevronRight size={16} /></button>
      </div>
      <footer className="sidebar-footer"><span><span className="tiny-dot" /> Built on open maps</span><button onClick={() => setDialog('about')}>About <ExternalLink size={12} /></button></footer>
    </aside>

    <section className="map-region" aria-label="Map">
      {config ? <MapView ref={map} config={config} destination={destination} fix={fix} follow={follow} onSelect={selectPoint} onDrag={pauseFollow} /> : <div className="map-loading"><Compass size={28} /><span>{configError || 'Loading the map…'}</span>{configError && <button onClick={() => setConfigAttempt(value => value + 1)}>Try again</button>}</div>}
      <div className="map-topbar"><div className="map-context"><span className="context-icon"><MapPin size={15} /></span><strong>{destination?.name ?? 'Kuala Lumpur'}</strong><span className="context-divider" /><span>{destination ? 'Selected place' : 'Malaysia'}</span></div><button className="info-button" onClick={() => setDialog('about')} aria-label="About OpenRoad"><Info size={19} /></button></div>
      {!pwa.online && <div className="offline-banner" role="status"><WifiOff size={16} />You are offline. Unloaded map areas need a connection.</div>}
      {pwa.waiting && <div className="update-banner">An update is ready. <button onClick={() => { location.stop(); pwa.update(); }}>Refresh app</button></div>}
      <div className="map-center-crosshair" aria-hidden="true" />
      <div className="map-controls"><div className="zoom-controls"><button aria-label="Zoom in" onClick={() => map.current?.zoom(1)}><Plus size={21} /></button><button aria-label="Zoom out" onClick={() => map.current?.zoom(-1)}><Minus size={21} /></button></div><button className={`locate-control ${follow ? 'active' : ''}`} aria-label="Find my location" onClick={locate} disabled={locating}><LocateFixed size={21} /></button></div>
      {destination ? <section className="destination-card" aria-label="Selected destination"><div className="destination-card-top"><span className="destination-card-icon"><MapPin size={23} /></span><div><span className="destination-label">YOUR DESTINATION</span><h2>{destination.name}</h2><p>{destination.detail}</p></div><button className="clear-destination" aria-label="Clear destination" onClick={() => setDestination(null)}><X size={18} /></button></div><div className="destination-card-bottom"><span><Check size={14} /> Pin selected</span><button onClick={() => { setFollow(false); map.current?.center(destination.point); }}>View on map <ArrowRight size={15} /></button></div></section>
        : <div className="map-instruction"><span><MapPin size={18} /></span><div><strong>Start with a pin</strong><p>Tap the map to choose your destination.</p></div></div>}
      <button className="select-center" onClick={() => { const point = map.current?.getCenter(); if (point) selectPoint(point); }} disabled={!config}><Crosshair size={15} /><span>Select map center</span></button>
      <div className="map-attribution"><span>OpenRoad</span><span>·</span>{config && <a href={config.attributionUrl} target="_blank" rel="noreferrer">{config.attribution}</a>}</div>
    </section>

    <dialog ref={dialogRef} className="app-dialog" onCancel={() => setDialog(null)} onClick={event => { if (event.target === event.currentTarget) setDialog(null); }} aria-labelledby="dialog-title"><button className="dialog-close" aria-label="Close dialog" onClick={() => setDialog(null)}><X size={20} /></button><span className="dialog-icon">{dialog === 'install' ? <ArrowDownToLine size={26} /> : <Compass size={26} />}</span><h2 id="dialog-title">{dialog === 'install' ? 'Keep OpenRoad on your home screen' : 'A map built on open data'}</h2>{dialog === 'install' ? <><p>On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen.</p><p>On Android or desktop, use your browser menu and choose Install app or Add to Home Screen when available.</p><p className="dialog-note">The app can open offline after your first visit. Map tiles still need a connection.</p></> : <><p>OpenRoad uses OpenStreetMap data and Leaflet. Choose a place on the map and use your device location to find your bearings.</p><p>Location is optional. We keep it in this session and do not save a location history. The map provider receives requests for the areas you view.</p><p className="dialog-note">This first release includes maps and location. Driving routes are next.</p><a className="dialog-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap attribution <ExternalLink size={14} /></a></>}</dialog>
    <div className="sr-only" aria-live="polite">{destination ? `${destination.name} selected as destination.` : ''}</div>
  </main>;
}
