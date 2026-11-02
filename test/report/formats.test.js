import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSlack, toPlain, toEmail, toHtml, emailSubject, convert, FORMATS } from '../../src/lib/report/formats.js';

const MD = `## Weekly update: Oct 27 to Oct 31

### Done
- Ship the login fix
- Standup notes (4 of 5 days)

### Tickets
- ENGX-1: Login timeout [In Review] (~1h 5m, Mon, Tue)
  - MR: Fix timeout [merged]
  - Doc: [Spec](https://x.test/spec?a=1&b=2)

### Blockers
- 
`;

test('slack: bold headings, bullets, nested bullets, links', () => {
  const s = toSlack(MD);
  assert.ok(s.startsWith('*Weekly update: Oct 27 to Oct 31*\n'));
  assert.match(s, /\n\*Done\*\n• Ship the login fix\n/);
  assert.match(s, /• ENGX-1: Login timeout \[In Review\] \(~1h 5m, Mon, Tue\)\n    ◦ MR: Fix timeout \[merged\]/);
  assert.match(s, /◦ Doc: <https:\/\/x\.test\/spec\?a=1&b=2\|Spec>/);
  assert.ok(!s.includes('#'));
});
test('slack: escapes &, <, > and keeps bold', () => {
  assert.equal(toSlack('- A & B <c> **x**'), '• A &amp; B &lt;c&gt; *x*\n');
  assert.equal(toSlack('- [a>b](https://e.test/p|q)'), '• <https://e.test/p%7Cq|a&gt;b>\n');
});
test('empty placeholder bullet is dropped everywhere', () => {
  for (const f of [toSlack, toPlain, toHtml]) assert.ok(!/-\s*$|•\s*$|<li><\/li>/m.test(f('### Blockers\n- ')), f.name);
});
test('plain: bullets as "- ", links as text (url), no markup', () => {
  const p = toPlain(MD);
  assert.match(p, /^Weekly update: Oct 27 to Oct 31\n/);
  assert.match(p, /\n  - Doc: Spec \(https:\/\/x\.test\/spec\?a=1&b=2\)/);
  assert.equal(toPlain('- [https://a.test](https://a.test) **b**'), '- https://a.test b\n');
  assert.ok(!p.includes('###'));
});
test('email: subject line + body without duplicate heading', () => {
  assert.equal(emailSubject(MD), 'Weekly update – week of Oct 27');
  const e = toEmail(MD);
  assert.ok(e.startsWith('Subject: Weekly update – week of Oct 27\n\nDone\n- Ship the login fix'));
  assert.ok(!e.includes('Weekly update: Oct'));
  assert.equal(emailSubject('## Standup\n\n### Today\n- x'), 'Standup');
  assert.equal(emailSubject('no heading'), 'Weekly update');
});
test('html: headings, nested lists, links', () => {
  const h = toHtml(MD);
  assert.ok(h.startsWith('<h2>Weekly update: Oct 27 to Oct 31</h2><h3>Done</h3><ul><li>Ship the login fix</li>'));
  assert.match(h, /<li>ENGX-1: [^<]*<ul><li>MR: Fix timeout \[merged\]<\/li><li>Doc: <a href="https:\/\/x\.test\/spec\?a=1&amp;b=2">Spec<\/a><\/li><\/ul><\/li><\/ul>/);
  const opens = (h.match(/<ul>/g) ?? []).length, closes = (h.match(/<\/ul>/g) ?? []).length;
  assert.equal(opens, closes);
});
test('html: escapes text, quotes and URLs; no raw tags from the draft', () => {
  const h = toHtml(`### <img src=x onerror=alert(1)>\n- "q" & 'a' <script>x</script>\n- [x"><b>](https://e.test/"onmouseover="y)`);
  assert.ok(!/<img|<script|<b>/.test(h));
  assert.match(h, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(h, /&quot;q&quot; &amp; &#39;a&#39; &lt;script&gt;/);
  assert.ok(!/href="[^"]*"[^>]*onmouseover/.test(h) || h.includes('&quot;onmouseover'));
  assert.ok(!/ onmouseover="/.test(h));
});
test('html: javascript: links stay text', () => {
  const h = toHtml('- [x](javascript:alert(1))');
  assert.ok(!h.includes('<a'));
});
test('html: unbalanced depth jumps and italic line', () => {
  assert.equal(toHtml('- a\n      - deep'), '<ul><li>a<ul><li>deep</li></ul></li></ul>');
  assert.equal(toHtml('_No work yet._'), '<p><em>No work yet.</em></p>');
  assert.equal(toHtml('- a\n\ntext'), '<ul><li>a</li></ul><p>text</p>');
});
test('markdown edge cases: stray * and _ are literal text', () => {
  assert.equal(toPlain('- snake_case and 2*3'), '- snake_case and 2*3\n');
  assert.equal(toHtml('- snake_case'), '<ul><li>snake_case</li></ul>');
  assert.equal(toPlain(''), '\n');
});
test('convert + FORMATS', () => {
  assert.equal(convert('markdown', MD).text, MD);
  assert.ok(convert('rich', MD).html?.startsWith('<h2>'));
  assert.equal(convert('slack', '- a').text, '• a\n');
  assert.deepEqual(FORMATS.map(f => f.id), ['markdown', 'slack', 'email', 'rich', 'ai']);
});

test('splitTags: pulls [status] tags out of text', async () => {
  const { splitTags, clampDepth, parse } = await import('../../src/lib/report/formats.js');
  assert.deepEqual(splitTags('ENGX-1: Login [In Review] (~1h)'), [
    { tag: false, text: 'ENGX-1: Login ' }, { tag: true, text: 'In Review' }, { tag: false, text: ' (~1h)' }]);
  assert.deepEqual(splitTags('plain'), [{ tag: false, text: 'plain' }]);
  assert.equal(clampDepth(parse('- a\n      - b'))[1]?.kind === 'li' && /** @type {any} */ (clampDepth(parse('- a\n      - b'))[1]).depth, 1);
});
