import { expect, it } from 'vitest';
import { parseRoute } from '../src/features/routing/route';
const lanes = [{ indications: ['left'], valid: true }, { indications: ['left', 'straight'], valid: true }, { indications: ['straight'], valid: false }];
it('accepts optional lanes and rejects malformed API lanes', () => {
  const step = {point:{lat:0,lng:0},distanceMeters:20,durationSeconds:10,name:'Road',type:'turn',modifier:'left',bearing:90,exit:null};
  const route = {points:[{lat:0,lng:0},{lat:0,lng:0.1}],distanceMeters:20,durationSeconds:10,steps:[{...step,lanes}]};
  expect(parseRoute(route).steps?.[0].lanes).toEqual(lanes);
  expect(parseRoute({...route,steps:[step]}).steps?.[0].lanes).toBeUndefined();
  expect(() => parseRoute({...route,steps:[{...step,lanes:[{indications:['left'],valid:'true'}]}]})).toThrow();
});
