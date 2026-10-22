import { describe, expect, it } from 'vitest';
import { getTimes } from 'suncalc';
import { solarAppearance } from '../src/features/appearance/solar';
const kl = { lat: 3.1485, lng: 101.7 };
describe('local sunrise/sunset appearance', () => {
  it('uses daylight at Malaysian noon and night after sunset regardless of device preference', () => {
    expect(solarAppearance(new Date('2026-10-22T12:00:00+08:00'), kl, 'dark')).toBe('light');
    expect(solarAppearance(new Date('2026-10-22T22:00:00+08:00'), kl, 'light')).toBe('dark');
    expect(solarAppearance(new Date('2026-10-22T04:00:00+08:00'), kl, 'light')).toBe('dark');
  });
  it('switches at the calculated sunrise and sunset boundaries', () => {
    const { sunrise, sunset } = getTimes(new Date('2026-10-22T04:00:00Z'), kl.lat, kl.lng);
    if (!sunrise || !sunset) throw new Error('Expected sunrise and sunset in Kuala Lumpur.');
    expect(solarAppearance(new Date(sunrise.getTime() - 1), kl, 'light')).toBe('dark');
    expect(solarAppearance(sunrise, kl, 'dark')).toBe('light');
    expect(solarAppearance(new Date(sunset.getTime() - 1), kl, 'dark')).toBe('light');
    expect(solarAppearance(sunset, kl, 'light')).toBe('dark');
  });
  it('falls back to device preference without location', () => {
    expect(solarAppearance(new Date(), null, 'dark')).toBe('dark');
    expect(solarAppearance(new Date(), null, 'light')).toBe('light');
  });
  it('handles polar day, polar night and locations on both sides of the date line', () => {
    const pole = { lat: 89, lng: 0 };
    expect(solarAppearance(new Date('2026-06-21T12:00:00Z'), pole, 'dark')).toBe('light');
    expect(solarAppearance(new Date('2026-12-21T12:00:00Z'), pole, 'light')).toBe('dark');
    for (const lng of [-179.9, 179.9]) {
      expect(solarAppearance(new Date('2026-10-22T00:00:00Z'), { lat: 0, lng }, 'dark')).toBe('light');
      expect(solarAppearance(new Date('2026-10-22T12:00:00Z'), { lat: 0, lng }, 'light')).toBe('dark');
    }
  });
});
