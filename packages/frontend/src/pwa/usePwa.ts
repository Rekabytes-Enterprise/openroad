'use client';

import { useEffect, useState } from 'react';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePwa() {
  const [online, setOnline] = useState(true);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  // These browser events outlive renders and must be removed when the app unmounts.
  useEffect(() => {
    setOnline(navigator.onLine);
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);
    let active = true;
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
        if (!active) return;
        if (registration.waiting) setWaiting(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (active && worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
          });
        });
      }).catch(() => { /* The map remains usable if installation is unavailable. */ });
    }
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return false;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    return true;
  }
  function update() {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage({ type: 'ACTIVATE' });
  }
  return { online, installed, install, waiting, update };
}
