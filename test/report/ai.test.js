import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ground, isEmptyDraft } from '../../src/lib/report/grounding.js';

// Real Gemini Nano output (Chrome 156, default sampling, the extension's own system prompt), 2 Nov 2026.
const fx = JSON.parse(readFileSync(new URL('../fixtures/nano-outputs.json', import.meta.url), 'utf8'));

fx.outputs.forEach((o, i) => test(`real Nano output ${i + 1} (${o.id}): true lines kept, invented ones dropped`, () => {
  const g = ground(fx.drafts[o.id], o.out);
  for (const k of o.keep) assert.ok(g.text.includes(k), `should keep “${k}”\n--- got:\n${g.text}\n--- dropped:\n${g.dropped.join('\n')}`);
  for (const k of o.drop) assert.ok(!g.text.includes(k), `should drop “${k}”\n--- got:\n${g.text}`);
}));

test('the Nov 2 screenshot: every invented line is dropped, nothing usable is left', () => {
  const out = `**Weekly Status Update - November 2nd to November 6th**
Here's a summary of activities during the week.
**High Priority - Merge Requests:**
- Anil-matcha/awesome-generative-ai-apps: Code changes were merged.
- Anil-matcha/awesome-generative-ai-apps: Commit \`a1b2c3d\` was included in the merged MR.
**Testing/QA:**
- Bug-123: Testing completed; status is Blocked.
- Bug-456: Testing completed; status is Open.
**Other:**
- Code review completed for MR \`a1b2c3d\`.
- Documentation updated for component X.`;
  const g = ground(fx.drafts.thin, out);
  assert.equal(g.text, '');
  assert.ok(g.dropped.length >= 7, g.dropped.join('\n'));
});

test('a faithful rewrite survives intact, real IDs and statuses included', () => {
  const d = '### Tickets\n- ENGX-1: Fix login timeout [In Review]\n  - MR: app !4: fix [merged]\n';
  const out = '### Engineering\n- Moved ENGX-1 (login timeout fix) to review; MR !4 merged.\n';
  assert.deepEqual(ground(d, out), { text: out, dropped: [] });
});

test('an outcome word must come from the log line it is about', () => {
  const d = '- Acme renewal call prep\n';
  assert.equal(ground(d, '- Acme renewal: deal won\n').text, '');
  assert.equal(ground(d, '- Prepared for the Acme renewal call\n').dropped.length, 0);
});

test('an empty week is never sent to the model', () => {
  assert.equal(isEmptyDraft(fx.drafts.empty), true);
  assert.equal(isEmptyDraft('## Standup\n\n### Yesterday\n- Nothing tracked.\n\n### Today\n- Nothing tracked yet.\n\n### Blockers\n- \n'), true);
  assert.equal(isEmptyDraft(fx.drafts.thin), false);
});

test('real Nano round 2: abbreviations in the log count; invented MR numbers and actions still go', () => {
  const g = ground(fx.drafts.eng, '- CSV export specification documentation.\n- Local app (localhost:3000) tested.\n- Documentation for CSV export was created.\n');
  assert.equal(g.text, '- CSV export specification documentation.\n');
  const t = ground(fx.drafts.thin, '- Anil-matcha/awesome-generative-ai-apps: MR #1234\n- MR numbered [12345] was open.\n- chrome.google.com: The page was open.\n');
  assert.equal(t.text, '- chrome.google.com: The page was open.\n');
});

test('real Nano round 3: repeated items and a made-up Done heading are cleaned up', () => {
  const out = '**Deals**\n* Worked on Customer 1\n* Reviewed Customer 2\n**Accounts**\n* Worked on Customer 1\n* Worked on Customer 2\n**Done**\n* Worked on Q4 pricing deck\n';
  const g = ground(fx.drafts.sales, out);
  assert.equal(g.text, '**Deals**\n* Worked on Customer 1\n* Reviewed Customer 2\n**Other**\n* Worked on Q4 pricing deck\n');
});

test('real Nano round 4: prompt examples copied into a thin week are dropped; spelled-out counts from the log stay', () => {
  const t = ground(fx.drafts.thin, '- Reviewed the CSV export spec.\n- Investigated the Safari test failures.\n- Worked on Anil-matcha/awesome-generative-ai-apps.\n');
  assert.equal(t.text, '- Worked on Anil-matcha/awesome-generative-ai-apps.\n');
  assert.equal(ground(fx.drafts.eng, '- Standup notes were taken for four out of five days.\n').dropped.length, 0);
});

test('real Nano round 5: "developed" a dashboard the log only shows was open is dropped', () => {
  assert.equal(ground(fx.drafts.eng, '## Data\n- Developed the Datadog API latency dashboard.\n').text, '');
  assert.equal(ground(fx.drafts.eng, '- Reviewed the Datadog API latency dashboard.\n').dropped.length, 0);
});
