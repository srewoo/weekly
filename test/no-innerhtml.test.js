import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const EXT = /\.(js|mjs|html)$/;
const files = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? files(p) : EXT.test(p) ? [p] : [];
});

const SINK = /\.(innerHTML|outerHTML)\s*\+?=(?!=)|\[\s*['"`](innerHTML|outerHTML)['"`]\s*\]|\b(innerHTML|outerHTML|srcdoc)\s*:|insertAdjacentHTML\s*\(|setHTMLUnsafe\s*\(|document\.write(ln)?\s*\(|createContextualFragment\s*\(|new\s+DOMParser\b/;

test('no HTML-string sinks anywhere in src/', () => {
  const offenders = files(root).filter((f) => SINK.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, []);
});
