import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

const stub = installChromeStub();
const { trackerStatus, onTrackingChanged } = await import('../../src/lib/activity/status.js');

test('trackerStatus reads the worker’s session state, null when absent', async () => {
  assert.deepEqual(await trackerStatus(), { current: null, error: null, tracking: true });
  stub.stores.session.current = { url: 'https://a.example/', title: 'A' };
  stub.stores.session.error = 'QUOTA_BYTES quota exceeded';
  assert.deepEqual(await trackerStatus(), { current: { url: 'https://a.example/', title: 'A' }, error: 'QUOTA_BYTES quota exceeded', tracking: true });
  stub.setGranted([]);
  assert.equal((await trackerStatus()).tracking, false, 'no tabs permission: tracking is off (W3)');
});

test('turning tracking on asks Chrome for tabs; off gives it back (W3)', async () => {
  const { allowTracking, stopTracking, trackingAllowed } = await import('../../src/lib/activity/status.js');
  stub.setGranted([]);
  assert.equal(await allowTracking(), true);
  assert.equal(await trackingAllowed(), true);
  await stopTracking();
  assert.equal(await trackingAllowed(), false);
});

test('onTrackingChanged fires for tracked days, settings, session status and the tabs permission only', () => {
  let n = 0;
  const off = onTrackingChanged(() => n++);
  const [fire] = stub.log.listeners['storage.onChanged'] ?? [];
  fire?.({ 'day:2026-10-29': {} }, 'local');
  fire?.({ settings: {} }, 'local');
  fire?.({ current: {} }, 'session');
  fire?.({ tasks: {} }, 'local');
  fire?.({ notes: {} }, 'local');
  fire?.({ settings: {} }, 'sync');
  assert.equal(n, 3);
  for (const name of ['permissions.onAdded', 'permissions.onRemoved']) for (const fn of stub.log.listeners[name] ?? []) fn({ permissions: ['tabs'] });
  assert.equal(n, 5, 'granting or revoking tabs redraws the footer');
  off();
  assert.equal(stub.log.listeners['storage.onChanged']?.length, 0);
  assert.equal(stub.log.listeners['permissions.onAdded']?.length, 0);
});
