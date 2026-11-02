// When the data was last exported. Weekly has no sync: the only copy lives in this Chrome profile,
// so the Settings page shows the age of the last backup and the report nudges once it is old.
const KEY = 'lastExportAt';
const DAY = 86400000;
export const NUDGE_DAYS = 30;

/** @returns {Promise<number | null>} */
export async function getLastExport() {
  const v = (await chrome.storage.local.get(KEY))[KEY];
  return typeof v === 'number' ? v : null;
}

/** @param {number} [now] */
export const markExported = (now = Date.now()) => chrome.storage.local.set({ [KEY]: now });

/** "never", "today", "yesterday", "12 days ago". @param {number | null | undefined} ts @param {number} [now] */
export function backupLabel(ts, now = Date.now()) {
  if (typeof ts !== 'number') return 'never';
  const d = Math.max(0, Math.floor((now - ts) / DAY));
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Nudge only someone who has data to lose. @param {number | null | undefined} ts @param {boolean} hasData @param {number} [now] */
export const needsBackupNudge = (ts, hasData, now = Date.now()) => hasData && (typeof ts !== 'number' || now - ts > NUDGE_DAYS * DAY);
