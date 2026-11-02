import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const stub = installChromeStub();
const { getUiState, updateUiState } = await import('../src/lib/storage.js');
const { coerceUiState, UNDATED_KEY } = await import('../src/lib/schema.js');
const { todayBands, createTask, getTasks } = await import('../src/lib/tasks.js');
const { today, addDays } = await import('../src/lib/dates.js');

test('the No date band is keyed by UNDATED_KEY, so its open state round-trips through uiState', async () => {
  await createTask({ title: 'Read the Q4 plan' });
  const band = todayBands(await getTasks()).find((b) => b.collapsible);
  assert.equal(band?.key, UNDATED_KEY);
  await updateUiState({ dayState: { [UNDATED_KEY]: 'open' } });
  assert.equal((await getUiState()).dayState[UNDATED_KEY], 'open');
});

test('coerceUiState keeps the undated key and future days, drops past days and junk', () => {
  const ref = today();
  const raw = { dayState: { [UNDATED_KEY]: 'closed', [addDays(ref, 1)]: 'open', [ref]: 'open',
    [addDays(ref, -1)]: 'open', 'not-a-date': 'open', [addDays(ref, 2)]: 'maybe' } };
  assert.deepEqual(coerceUiState(raw, ref).dayState, { [UNDATED_KEY]: 'closed', [addDays(ref, 1)]: 'open', [ref]: 'open' });
  assert.deepEqual(coerceUiState('junk', ref), { dayState: {} });
});

test('a stored uiState is read through coerceUiState', async () => {
  stub.stores.local.uiState = { dayState: { [addDays(today(), -3)]: 'open', [UNDATED_KEY]: 'open' } };
  assert.deepEqual((await getUiState()).dayState, { [UNDATED_KEY]: 'open' });
});
