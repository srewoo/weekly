import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {}
class FakeEl extends FakeNode {
  constructor(t) { super(); this.tagName = t; this.children = []; this.attributes = {}; this.dataset = {}; this.style = {}; this.listeners = {}; }
  append(...c) { this.children.push(...c); }
  setAttribute(a, v) { this.attributes[a] = v; }
  addEventListener(e, f) { this.listeners[e] = f; }
}
class FakeText extends FakeNode { constructor(t) { super(); this.textContent = t; } }
globalThis.Node = FakeNode;
globalThis.document = { createElement: (t) => new FakeEl(t), createTextNode: (t) => new FakeText(t) };

const { h } = await import('../../src/ui/components/dom.js');

const withSilencedWarn = (fn) => {
  const orig = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = orig; }
};

test('(a) string child is text, never markup', () => {
  const el = h('p', {}, '<img src=x onerror=alert(1)>');
  assert.equal(el.children.length, 1);
  assert.ok(el.children[0] instanceof FakeText);
  assert.equal(el.children[0].textContent, '<img src=x onerror=alert(1)>');
});

for (const props of [{ innerHTML: 'x' }, { outerHTML: 'x' }, { srcdoc: 'x' }, { onclick: 'x' }]) {
  test(`(b) h() throws for prop ${Object.keys(props)[0]}`, () => {
    assert.throws(() => h('div', props), /not allowed/);
  });
}

for (const attrs of [{ onclick: 'x' }, { srcdoc: 'x' }]) {
  test(`(b) h() throws for attrs ${Object.keys(attrs)[0]}`, () => {
    assert.throws(() => h('div', { attrs }), /not allowed/);
  });
}

test('(c) on: { click } registers the listener', () => {
  const fn = () => {};
  const el = h('button', { on: { click: fn } });
  assert.equal(el.listeners.click, fn);
});

test('(d) javascript: URLs are not set on href (prop or attrs)', () => {
  withSilencedWarn(() => {
    const a = h('a', { href: 'javascript:alert(1)' });
    assert.equal(a.href, undefined);
    const b = h('a', { href: ' JavaScript:x' });
    assert.equal(b.href, undefined);
    const c = h('a', { attrs: { href: 'javascript:x' } });
    assert.equal(c.attributes.href, undefined);
  });
});

for (const attrs of [{ HREF: 'javascript:x' }, { formaction: 'javascript:x' }, { 'xlink:href': 'javascript:x' }]) {
  test(`(f) unsafe URL attrs ${Object.keys(attrs)[0]} are not set`, () => {
    withSilencedWarn(() => {
      const el = h('a', { attrs });
      assert.deepEqual(el.attributes, {});
    });
  });
}

for (const attrs of [{ SRCDOC: 'x' }, { OnClick: 'x' }]) {
  test(`(f) attrs ${Object.keys(attrs)[0]} throws`, () => {
    assert.throws(() => h('div', { attrs }), /not allowed/);
  });
}

test('(f) normal attrs are set', () => {
  const el = h('button', { attrs: { 'aria-label': 'Close', role: 'img' } });
  assert.deepEqual(el.attributes, { 'aria-label': 'Close', role: 'img' });
});

test('(e) safe URLs are set', () => {
  assert.equal(h('a', { href: 'https://a.test/x' }).href, 'https://a.test/x');
  assert.equal(h('a', { href: 'report.html' }).href, 'report.html');
  assert.equal(h('a', { href: '#top' }).href, '#top');
  assert.equal(h('img', { src: 'chrome-extension://id/p.png' }).src, 'chrome-extension://id/p.png');
});
