import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('extension pages run only our own scripts: explicit CSP (spec D13)', () => {
  assert.equal(manifest.content_security_policy?.extension_pages,
    "script-src 'self'; object-src 'none'; base-uri 'none'");
});

test('commands: Alt+T opens the side panel, Alt+Shift+T the app (spec D10)', () => {
  assert.equal(manifest.commands?.['open-panel']?.suggested_key?.default, 'Alt+T');
  assert.equal(manifest.commands?.['open-app']?.suggested_key?.default, 'Alt+Shift+T');
});

test('on-page note: activeTab + scripting and Alt+N, no host permissions or content scripts (spec §3.4, §3.6)', () => {
  assert.ok(manifest.permissions.includes('activeTab') && manifest.permissions.includes('scripting'));
  assert.equal(manifest.commands?.['open-note']?.suggested_key?.default, 'Alt+N');
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined, 'injected on demand only');
});

test('tabs is optional: the install asks for no browsing-history warning; Weekly asks when you turn tracking on (W3, spec §3.6)', () => {
  assert.equal(manifest.permissions.includes('tabs'), false);
  assert.ok(manifest.optional_permissions.includes('tabs') && manifest.optional_permissions.includes('history'));
});

test('manifest.json and package.json carry the same version, so the zip is named after what Chrome shows', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version, pkg.version);
});

