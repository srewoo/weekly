// Words the pages show about private notes and exports (Phase 4 final review, parked to the release).
// Chrome stops an idle background worker after about 30 seconds, and the key goes with it,
// so no page may promise five unlocked minutes. An export carries the PIN check value, so a
// short PIN can be guessed from a copy of the file: Settings must say so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('the unlock dialog says private notes lock after 5 idle minutes or sooner, never that they stay open 5 minutes', () => {
  const dialog = read('src/ui/components/pin-dialog.js');
  assert.doesNotMatch(dialog, /for 5 minutes after/);
  assert.match(dialog, /after 5 minutes without use, or sooner/);
});

test('Settings say to keep export files private and that a longer PIN is safer', () => {
  const report = read('src/ui/settings/settings.html');
  assert.match(report, /Keep export files private/);
  assert.match(report, /use 6 to 8 digits/);
});
