// The only owner of the report's own keys: per-week exclusions, saved drafts, share consents,
// the "Copy as" choice and the status nudge. UI code reads and writes them through here, never chrome.storage.

/** @param {string} week ISO Monday */
const exKey = (week) => 'excluded:' + week;

/** Item keys unticked for that week. @param {string} week @returns {Promise<string[]>} */
export async function getExcluded(week) {
  const v = (await chrome.storage.local.get(exKey(week)))[exKey(week)];
  return Array.isArray(v) ? v.filter((k) => typeof k === 'string') : [];
}

/** @param {string} week @param {Iterable<string>} keys */
export const saveExcluded = (week, keys) => chrome.storage.local.set({ [exKey(week)]: [...keys] });

/** A saved (edited) draft, or undefined. @param {string} key e.g. draft:weekly:2026-11-02 @returns {Promise<string | undefined>} */
export async function getDraft(key) {
  const v = (await chrome.storage.local.get(key))[key];
  return typeof v === 'string' ? v : undefined;
}

/** @param {string} key @param {string} text */
export const saveDraft = (key, text) => chrome.storage.local.set({ [key]: text });

/** @param {string} key */
export const removeDraft = (key) => chrome.storage.local.remove(key);

/** @returns {Promise<{ shareOk: Record<string, boolean>, lastExportAt: number | undefined, statusNudgeOff: boolean, copyAs: string | undefined }>} */
export async function getReportPrefs() {
  const st = await chrome.storage.local.get(['shareOk', 'lastExportAt', 'statusNudgeOff', 'copyAs']);
  return { shareOk: st['shareOk'] || {}, lastExportAt: st['lastExportAt'], statusNudgeOff: !!st['statusNudgeOff'], copyAs: st['copyAs'] };
}

/** @param {Record<string, boolean>} shareOk */
export const saveShareOk = (shareOk) => chrome.storage.local.set({ shareOk });
export const hideStatusNudge = () => chrome.storage.local.set({ statusNudgeOff: true });
/** @param {string} id */
export const saveCopyAs = (id) => chrome.storage.local.set({ copyAs: id });

/** v1 kept one global exclusion list; it is per week now. */
export const dropLegacyExcluded = () => chrome.storage.local.remove('excluded');

/** Call `cb` when tracked activity changes (this device, imports or history estimates). @param {() => void} cb */
export function onActivityChanged(cb) {
  chrome.storage.onChanged.addListener((c, area) => {
    if (area === 'local' && Object.keys(c).some((k) => /^(day|imp|hist):/.test(k))) cb();
  });
}
