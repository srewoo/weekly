// The parity gate. The feature-parity checklist is done when every row is proved by a unit test
// or an end-to-end check (its "Definition of done"). For each row this prints the proofs from
// test/parity-proofs.mjs and fails when a row has none, a unit test named there is not in its
// file, or an end-to-end check named there did not pass in the last `npm run e2e` / `npm run e2e:zip`.
// Run it after both: `npm test` proves the unit tests pass, the end-to-end results are read here.
// Usage: node scripts/parity.mjs [checklist.md]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROOFS } from '../test/parity-proofs.mjs';

const root = new URL('..', import.meta.url).pathname;
const spec = process.argv[2] ?? join(root, 'docs/superpowers/specs/2026-10-31-weekly-feature-parity.md');
const rows = [...readFileSync(spec, 'utf8').matchAll(/^\|\s*([A-Z]\d+)\b[^|]*\|\s*([^|]+?)\s*\|/gm)].map(([, id, feature]) => ({ id, feature }));

const results = ['.e2e/results.json', '.e2e/no-tabs/results.json'].map((f) => join(root, f));
if (!results.every((f) => existsSync(f))) {
  console.error('No end-to-end results. Run npm run e2e (or npm run e2e:zip) first.');
  process.exit(1);
}
/** @type {{ area: string, name: string, ok: boolean }[]} */
const checks = results.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const key = (/** @type {{ area: string, name: string }} */ c) => `[${c.area}] ${c.name}`;
const failed = new Set(checks.filter((c) => !c.ok).map(key));
const passed = new Set(checks.filter((c) => c.ok && !failed.has(key(c))).map(key));
/** @param {string} file @param {string} name */
const unitExists = (file, name) => existsSync(join(root, file))
  && new RegExp(`^\\s*test\\(\\s*(['"\`])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`, 'm').test(readFileSync(join(root, file), 'utf8'));
/** @param {{ e2e?: string, file?: string, unit?: string }} p */
const proved = (p) => (p.e2e ? passed.has(p.e2e) : unitExists(p.file ?? '', p.unit ?? ''));
/** @param {{ e2e?: string, file?: string, unit?: string }} p */
const label = (p) => (p.e2e ? `e2e ${p.e2e}` : `unit ${p.file}: ${p.unit}`);

let bad = 0;
for (const { id, feature } of rows) {
  const proofs = /** @type {Record<string, object[]>} */ (PROOFS)[id] ?? [];
  const missing = proofs.filter((p) => !proved(p));
  if (!proofs.length || missing.length) bad++;
  console.log(`${!proofs.length || missing.length ? 'FAIL' : 'ok  '} ${id.padEnd(4)} ${feature.slice(0, 70)}`);
  if (!proofs.length) console.log('       no proof named for this row');
  for (const p of missing) console.log(`       not proved: ${label(p)}`);
}
const stale = Object.keys(PROOFS).filter((id) => !rows.some((r) => r.id === id));
for (const id of stale) console.log(`FAIL ${id.padEnd(4)} has proofs but is not a row of the checklist`);
console.log(`\nParity: ${rows.length - bad}/${rows.length} rows proved (${checks.length} end-to-end checks read)`);
process.exit(bad || stale.length ? 1 : 0);
