import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backupLabel, needsBackupNudge } from '../src/lib/last-backup.js';

const NOW = Date.UTC(2026, 10, 2);
const ago = (d) => NOW - d * 86400000;

test('the backup age is said in words', () => {
  assert.equal(backupLabel(null, NOW), 'never');
  assert.equal(backupLabel(ago(0), NOW), 'today');
  assert.equal(backupLabel(ago(1), NOW), 'yesterday');
  assert.equal(backupLabel(ago(12), NOW), '12 days ago');
});

test('only someone with data, and no backup or an old one, is nudged', () => {
  assert.equal(needsBackupNudge(null, true, NOW), true);
  assert.equal(needsBackupNudge(ago(31), true, NOW), true);
  assert.equal(needsBackupNudge(ago(30), true, NOW), false);
  assert.equal(needsBackupNudge(null, false, NOW), false);
});
