/** Initial camera tuning, kept separate so physical-drive feedback can refine it. */
export function drivingZoom(speed: number | null | undefined, turnMeters: number | null): number {
  if (turnMeters !== null && turnMeters < 120) return 17;
  const kmh = typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? speed * 3.6 : 0;
  if (kmh >= 80) return 15.5;
  if (kmh >= 50) return 16;
  return 16.5;
}
export function drivingAnchor(width: number, height: number, top: number, bottom: number, left = 0): [number, number] {
  const available = Math.max(0, height - top - bottom);
  return [left + (width - left) / 2, top + available * 0.75];
}
