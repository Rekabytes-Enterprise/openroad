import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationController } from '../src/features/location/location';
import { parseMapConfig, validPoint } from '../src/features/map/types';
import config from '../public/map-config.json';

describe('location lifecycle', () => {
  let success: PositionCallback;
  let failure: PositionErrorCallback | null;
  const clearWatch = vi.fn();
  const watchPosition = vi.fn((onSuccess: PositionCallback, onError?: PositionErrorCallback | null) => {
    success = onSuccess;
    failure = onError ?? null;
    return 7;
  });
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts only on request, owns one watcher, pauses and resumes without a hidden watcher', () => {
    const controller = new LocationController(() => ({ watchPosition, clearWatch }));
    expect(watchPosition).not.toHaveBeenCalled();
    controller.enable(); controller.enable();
    expect(watchPosition).toHaveBeenCalledTimes(1);
    controller.pause();
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(controller.getSnapshot().status).toBe('paused');
    controller.resume();
    expect(watchPosition).toHaveBeenCalledTimes(2);
    controller.stop(); controller.resume();
    expect(watchPosition).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('marks old fixes stale and ignores late fixes after Stop', () => {
    const controller = new LocationController(() => ({ watchPosition, clearWatch }));
    controller.enable();
    const position: GeolocationPosition = {
      timestamp: Date.now(),
      coords: { latitude: 3.15, longitude: 101.71, accuracy: 12, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
      toJSON: () => ({}),
    };
    success(position);
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', stale: false, fix: { accuracy: 12 } });
    vi.advanceTimersByTime(15001);
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', stale: true });
    controller.stop(); success(position);
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it.each([2, 3])('keeps watching after transient error %s and accepts a later fix', code => {
    const controller = new LocationController(() => ({ watchPosition, clearWatch }));
    controller.enable();
    failure?.({ code, message: 'Transient', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(clearWatch).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ status: 'requesting', message: expect.stringContaining('Still listening') });
    controller.enable();
    expect(watchPosition).toHaveBeenCalledTimes(1);
    success({ timestamp: Date.now(), coords: { latitude: 3.15, longitude: 101.71, accuracy: 30, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) }, toJSON: () => ({}) });
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', stale: false });
    failure?.({ code, message: 'Transient', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', stale: true, fix: { accuracy: 30 } });
    controller.stop();
    expect(clearWatch).toHaveBeenCalledWith(7);
    failure?.({ code, message: 'Late error', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(controller.getSnapshot().status).toBe('idle');
  });

  it('clears the watch after denial and does not resume it', () => {
    const controller = new LocationController(() => ({ watchPosition, clearWatch }));
    controller.enable();
    failure?.({ code: 1, message: 'Denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', message: expect.stringContaining('blocked') });
    controller.resume();
    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('offers manual selection when browser geolocation is unavailable', () => {
    const controller = new LocationController(() => undefined);
    controller.enable();
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', message: expect.stringContaining('choose a place') });
  });
});

describe('map configuration boundary', () => {
  it('accepts the configured tile source and rejects missing or insecure providers', () => {
    expect(parseMapConfig(config)).toEqual(config);
    expect(() => parseMapConfig({ ...config, tileUrl: 'http://invalid/{z}/{x}/{y}' })).toThrow();
    expect(() => parseMapConfig({ ...config, initialCenter: { lat: 101, lng: 3 } })).toThrow();
    expect(() => parseMapConfig({ ...config, maxZoom: Number.NaN })).toThrow();
    expect(() => parseMapConfig(null)).toThrow();
  });
  it('rejects invalid coordinates before they reach Leaflet', () => {
    expect(validPoint({ lat: 3.15, lng: 101.71 })).toBe(true);
    expect(validPoint({ lat: NaN, lng: 0 })).toBe(false);
    expect(validPoint({ lat: 0, lng: Infinity })).toBe(false);
    expect(validPoint({ lat: 91, lng: 0 })).toBe(false);
  });
});
