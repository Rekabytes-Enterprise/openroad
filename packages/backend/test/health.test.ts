import { test } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../src/app.js';

test('health returns a ready service and unknown routes return 404', async () => {
  const response = await app.request('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'openroad-backend' });
  assert.equal((await app.request('/unknown')).status, 404);
});
