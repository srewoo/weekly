// uiState and reminderState writes are serialised read-modify-writes (deferred
// from Phase 2a): the evening window and the worker both write reminderState,
// and the side panel and the app tab both write uiState.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from './helpers/chrome-stub.js';

const ctx = installChromeStub();
const { getUiState, updateUiState, getReminderState, updateReminderState, UI_LOCK, REMINDER_LOCK } = await import('../src/lib/storage.js');
const { today } = await import('../src/lib/dates.js');

const DAY = today();
const reset = () => { for (const k of Object.keys(ctx.stores.local)) delete ctx.stores.local[k]; };

test('two reminderState writes at the same instant both land', async () => {
  reset();
  await Promise.all([updateReminderState({ morningLastShown: DAY }), updateReminderState({ eveningLastShown: DAY })]);
  const s = await getReminderState();
  assert.equal(s.morningLastShown, DAY);
  assert.equal(s.eveningLastShown, DAY, 'the second write must not start from a read taken before the first landed');
});

test('two uiState band toggles from different pages both land (function form)', async () => {
  reset();
  await Promise.all([
    updateUiState((cur) => ({ dayState: { ...cur.dayState, undated: 'open' } })),
    updateUiState((cur) => ({ dayState: { ...cur.dayState, [DAY]: 'closed' } })),
  ]);
  assert.deepEqual((await getUiState()).dayState, { undated: 'open', [DAY]: 'closed' });
});

test('both take their own Web Lock when the platform has one', async () => {
  reset();
  /** @type {string[]} */
  const names = [];
  const locks = { request: (/** @type {string} */ name, /** @type {() => Promise<unknown>} */ fn) => { names.push(name); return fn(); } };
  Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true });
  try {
    await updateUiState({ dayState: {} });
    await updateReminderState({ morningLastShown: null });
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  }
  assert.deepEqual(names, [UI_LOCK, REMINDER_LOCK]);
  assert.deepEqual([UI_LOCK, REMINDER_LOCK], ['weekly:ui', 'weekly:reminders']);
});
