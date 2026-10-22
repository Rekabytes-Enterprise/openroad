import { expect, it } from 'vitest';
import { drivingAnchor, drivingZoom } from '../src/features/map/drivingCamera';
it('positions the vehicle below center while clearing the header and sheet', () => {
  expect(drivingAnchor(390,844,96,195)).toEqual([195,510.75]);
  const [x,y] = drivingAnchor(1440,900,24,24,404);
  expect(x).toBe(922); expect(y).toBe(663);
});
it('widens for speed and shows closer detail near a turn', () => {
  expect(drivingZoom(null,null)).toBe(16.5);
  expect(drivingZoom(10,300)).toBe(16.5);
  expect(drivingZoom(16,300)).toBe(16);
  expect(drivingZoom(25,500)).toBe(15.5);
  expect(drivingZoom(25,80)).toBe(17);
});
