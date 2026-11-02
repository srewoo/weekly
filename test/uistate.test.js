/**
 * Popup UI state — which day bands the user has opened or closed.
 *
 * It lives in storage.local rather than sync on purpose: sync caps at 100KB
 * across every key, and a per-day map that grew unbounded would eventually
 * start throwing QUOTA_BYTES in the middle of a settings write.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const { getUiState, updateUiState } = await import('../src/lib/storage.js');
const { coerceUiState, defaultUiState } = await import('../src/lib/schema.js');
const { today, addDays } = await import('../src/lib/dates.js');

// Relative to the real today: getUiState() prunes against today(), so a fixed
// date here turns into a failing test the day after it passes.
const REF = today();
/** @param {number} n */
const day = (n) => addDays(REF, n);

async function reset() {
  for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k];
}

test('an absent blob reads as the default, not a crash', async () => {
  await reset();
  assert.deepEqual(await getUiState(), defaultUiState());
});

test('a day the user closed is still closed on the next read', async () => {
  await reset();
  await updateUiState({ dayState: { [REF]: 'closed' } });
  assert.equal((await getUiState()).dayState[REF], 'closed');
});

test('a day the user opened is remembered too — overrides run both ways', () => {
  const state = coerceUiState({ dayState: { [REF]: 'open' } }, REF);
  assert.equal(state.dayState[REF], 'open');
});

test('days before today are pruned, so the map cannot grow without bound', () => {
  const state = coerceUiState({
    dayState: { [day(-19)]: 'open', [day(-1)]: 'closed', [REF]: 'closed', [day(5)]: 'open' },
  }, REF);
  assert.deepEqual(Object.keys(state.dayState).sort(), [REF, day(5)]);
});

test('the undated band is exempt from pruning — it has no date to age out', () => {
  const state = coerceUiState({ dayState: { undated: 'open' } }, REF);
  assert.equal(state.dayState.undated, 'open');
});

test('junk in the blob is dropped rather than rendered', () => {
  const state = coerceUiState({
    dayState: { 'not-a-date': 'open', [REF]: 'sideways', [day(1)]: 'open' },
  }, REF);
  assert.deepEqual(state.dayState, { [day(1)]: 'open' });
});

test('a non-object blob falls back to the default', () => {
  assert.deepEqual(coerceUiState('nonsense', REF), defaultUiState());
  assert.deepEqual(coerceUiState(null, REF), defaultUiState());
});
