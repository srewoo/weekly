// Export and import (D11, F7; spec §4 Import, §6). backup.js reads and validates a
// file; this writes what it accepted, in one storage write, and builds the export.
import { withLock, TASKS_LOCK } from './storage.js';
import { migrate, coerceTaskList, SCHEMA_VERSION } from './schema.js';
import { NOTES_LOCK, coerceNote, coerceNoteList, mergeNoteLists } from './notes.js';
import { SETTINGS_LOCK, readSettings, importableSettings } from './settings.js';
import { mergeTaskLists } from './task-portability.js';
import { readBackup, cleanDay } from './backup.js';

/** @typedef {import('./backup.js').Backup} Backup */
/** @typedef {import('./notes.js').Note} Note */
/** @typedef {import('./crypto.js').Security} Security */
/** @typedef {{ mode: 'merge' | 'replace', pin?: string, localPin?: string, keep?: 'mine' | 'theirs' }} ImportChoice */
/**
 * What the PIN broker adds when a backup has private notes (crypto:import).
 * @typedef {object} Sealing
 * @property {Note[]} incoming  the file's notes, private ones sealed under the PIN that wins
 * @property {((mine: Note[]) => Promise<Note[]>) | null} reseal  my private notes under that PIN ('theirs')
 * @property {Security | null} security  the file's PIN record, adopted
 */
/** @typedef {{ tasks: number, notes: number, days: number }} Added */

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const IMP = /^imp:([\w-]{1,64}):\d{4}-\d{2}-\d{2}$/;

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * What Export writes (D11, F7): activity, tasks, notes as stored (private ones as
 * ciphertext), the PIN record (a salt and a check value, never the PIN), settings
 * without the Slack webhook (a secret), and the device ID. Drafts, history
 * estimates and page state stay behind.
 * @param {Record<string, unknown>} all
 */
export function exportPayload(all) {
  /** @type {Record<string, unknown>} */
  const out = { app: 'Weekly', version: 3 };
  for (const [k, v] of Object.entries(all)) if (/^(day|meta):/.test(k) || ['notes', 'tasks', 'security', 'deviceId'].includes(k)) out[k] = v;
  const s = all['settings'];
  if (typeof s === 'object' && s !== null && !Array.isArray(s)) {
    const { slackWebhook, ...rest } = /** @type {Record<string, unknown>} */ (s);
    out['settings'] = rest;
  }
  return out;
}

/** Everything a backup contains, read from storage. */
export async function exportAll() {
  return exportPayload(await chrome.storage.local.get(null));
}

/** A chosen file, size-checked before it is read, then recognised and validated. Writes nothing. @param {Blob} file @returns {Promise<Backup>} */
export async function openBackup(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('File is too large (max 20 MB).');
  const { deviceId } = await chrome.storage.local.get('deviceId');
  return readBackup(await file.text(), typeof deviceId === 'string' ? deviceId : undefined);
}

/**
 * An accepted backup, checked again: the worker gets it over a message, which is untrusted too.
 * @param {unknown} raw
 */
function recheck(raw) {
  const o = isObj(raw) ? raw : {};
  const c = isObj(o['carries']) ? o['carries'] : {};
  const dev = typeof o['deviceId'] === 'string' && /^[\w-]{1,64}$/.test(o['deviceId']) ? o['deviceId'] : null;
  /** @type {Record<string, object>} */
  const activity = {};
  for (const [k, v] of Object.entries(isObj(o['activity']) ? o['activity'] : {})) if (dev && IMP.exec(k)?.[1] === dev && isObj(v)) activity[k] = cleanDay(v);
  return {
    carries: { tasks: c['tasks'] === true, notes: c['notes'] === true },
    tasks: coerceTaskList(o['tasks']).tasks,
    notes: (Array.isArray(o['notes']) ? o['notes'] : []).flatMap((n) => { const x = coerceNote(n); return x && !x.enc ? [x] : []; }),
    settings: importableSettings(o['settings']),
    activity, dev,
  };
}

/**
 * Write an accepted backup in ONE storage write (spec §6: validated first, then written
 * once), under the task, settings and notes locks, always taken in that order. Replace
 * swaps only what the file carries; Merge keeps every task here and the newer copy of a
 * note; settings come in on Replace only, the local Slack webhook kept; the other
 * browser's activity goes under imp:<device>:<date>, so the same file twice replaces
 * rather than double-counts. When the write fails, nothing has changed.
 * `sealing` comes only from the PIN broker, the one writer of the PIN record.
 * @param {unknown} raw @param {'merge' | 'replace'} mode @param {Sealing | null} [sealing]
 * @returns {Promise<Added>} what was added
 */
export function writeBackup(raw, mode, sealing = null) {
  const b = recheck(raw);
  const replace = mode === 'replace';
  return withLock(TASKS_LOCK, () => withLock(SETTINGS_LOCK, () => withLock(NOTES_LOCK, async () => {
    const cur = await chrome.storage.local.get(['tasks', 'schemaVersion', 'settings', 'notes', 'imports']);
    /** @type {Record<string, unknown>} */
    const out = {};
    const added = { tasks: 0, notes: 0, days: Object.keys(b.activity).length };
    if (b.carries.tasks) {
      const t = replace ? { tasks: b.tasks, added: b.tasks.length } : mergeTaskLists(migrate(cur).tasks, b.tasks);
      out['tasks'] = t.tasks;
      out['schemaVersion'] = SCHEMA_VERSION;
      added.tasks = t.added;
    }
    if (replace && b.settings) out['settings'] = readSettings({ ...readSettings(cur['settings']), ...b.settings });
    if (sealing || b.carries.notes) {
      const mine = coerceNoteList(cur['notes']).notes;
      const base = replace ? [] : sealing?.reseal ? await sealing.reseal(mine) : mine;
      const m = mergeNoteLists(base, sealing ? sealing.incoming : b.notes);
      out['notes'] = m.notes;
      added.notes = m.added;
      if (sealing?.security) out['security'] = sealing.security;
    }
    if (b.dev && added.days) {
      const imports = Array.isArray(cur['imports']) ? cur['imports'].filter((d) => typeof d === 'string') : [];
      out['imports'] = [...new Set([...imports, b.dev])];
    }
    await chrome.storage.local.set({ ...b.activity, ...out });
    return added;
  })));
}

/**
 * A failed import in plain words (spec §6): a full quota says so, like undo.js's report().
 * The worker's own refusals (a wrong PIN) are already in words; anything else says nothing came in.
 * @param {unknown} e @param {boolean} raw  a storage error, not one of the worker's words
 */
function notImported(e, raw) {
  const m = e instanceof Error ? e.message : String(e);
  if (/quota/i.test(m)) return 'Storage is full, so nothing was imported. Export and delete old weeks, then try again.';
  return raw ? `Nothing was imported: ${m}` : m;
}

/**
 * Write a backup readBackup accepted. Private notes with their PIN record go to the
 * worker, which opens and seals them and writes the whole import in the same single
 * write; a wrong PIN there stops the import before anything is written.
 * @param {Backup} b @param {ImportChoice} c @returns {Promise<Added>} what was added
 */
export async function applyBackup(b, c) {
  if (!(b.sealed.length && b.security)) return writeBackup(b, c.mode).catch((e) => { throw new Error(notImported(e, true)); });
  const r = await chrome.runtime.sendMessage({ ...b, type: 'crypto:import', mode: c.mode, pin: c.pin, localPin: c.localPin, keep: c.keep });
  if (!r?.ok) throw new Error(r?.error ? notImported(r.error, false) : 'Weekly’s background worker did not answer, so nothing was imported.');
  return { tasks: r.tasks ?? 0, notes: r.added ?? 0, days: r.days ?? 0 };
}

// Settings, the device ID and the notes PIN stay. Tasks and notes are emptied through their own locks, never removed behind their backs.
const KEEP = new Set(['settings', 'deviceId', 'tasks', 'schemaVersion', 'notes', 'security']);

/** Delete all activity, drafts and report state; keep what KEEP names. */
export async function deleteActivity() {
  const all = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(all).filter((k) => !KEEP.has(k)));
}
