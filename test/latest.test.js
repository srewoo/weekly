import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latest } from '../src/lib/latest.js';

test('latest: two loads resolving out of order, only the last call applies', async () => {
  const guard = latest();
  /** @type {string[]} */
  const applied = [];
  const deferred = () => { let r; const p = new Promise((res) => { r = res; }); return { p, r }; };
  const load = async (name, d) => { const mine = guard(); await d.p; if (mine()) applied.push(name); };
  const a = deferred(); const b = deferred();
  const first = load('week-1', a); const second = load('week-2', b);
  b.r(); await second;
  a.r(); await first;
  assert.deepEqual(applied, ['week-2']);
});
