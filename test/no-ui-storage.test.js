import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/ui', import.meta.url).pathname;
const files = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
});

test('ui/ never touches chrome.storage: every key has an owner in lib/', () => {
  const offenders = files(root).filter((f) => /chrome\.storage\.\w+\.|chrome\.storage\.onChanged/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});
