'use client';

import { useEffect, useState } from 'react';
import type { Point } from '../map/types';
import { solarAppearance, type Appearance } from './solar';

export function useAppearance(point: Point | null): Appearance {
  const [appearance, setAppearance] = useState<Appearance>('light');
  const lat = point?.lat;
  const lng = point?.lng;
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const next = solarAppearance(new Date(), lat === undefined || lng === undefined ? null : { lat, lng }, media.matches ? 'dark' : 'light');
      setAppearance(next);
      document.documentElement.dataset.theme = next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#151c25' : '#ffffff');
    };
    update();
    // Browsers throttle background timers. Re-evaluate immediately on resume.
    const timer = window.setInterval(update, 30000);
    const onVisible = () => { if (!document.hidden) update(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', update);
    media.addEventListener('change', update);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', update);
      media.removeEventListener('change', update);
    };
  }, [lat, lng]);
  return appearance;
}
