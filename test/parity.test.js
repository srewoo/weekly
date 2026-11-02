// Meta check for parity row D14: the carried-over uistate test must stay date-independent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the carried-over uistate test derives every date from today() and has no hard-coded date', () => {
  const src = readFileSync(new URL('./uistate.test.js', import.meta.url), 'utf8');
  assert.match(src, /const REF = today\(\)/, 'dates must be relative to today()');
  assert.doesNotMatch(src, /\b20\d\d-\d\d-\d\d\b/, 'a fixed date fails the day after it passes');
  assert.doesNotMatch(src, /new Date\(\s*\)|Date\.now\(/, 'no direct clock reads');
});
