// What the tracker is doing right now, for the side panel footer, and whether it
// may track at all. The worker writes `current` and `error` to storage.session;
// this is their read side. Tracking needs the optional "tabs" permission (W3,
// spec §3.6): without it Weekly is tasks and notes, and nothing is recorded.

/** @typedef {{ url: string, title?: string }} Current */

const TABS = { permissions: ['tabs'] };

/** @returns {Promise<boolean>} */
export const trackingAllowed = () => chrome.permissions.contains(TABS);
/** Asks Chrome; call it straight from a click, since Chrome only asks during a user gesture. @returns {Promise<boolean>} */
export const allowTracking = () => chrome.permissions.request(TABS);
/** @returns {Promise<boolean>} */
export const stopTracking = () => chrome.permissions.remove(TABS);

/** @returns {Promise<{ current: Current | null, error: string | null, tracking: boolean }>} */
export async function trackerStatus() {
  const [{ current, error }, tracking] = await Promise.all([chrome.storage.session.get(['current', 'error']), trackingAllowed()]);
  return { current: current ?? null, error: typeof error === 'string' ? error : null, tracking };
}

/**
 * Call `cb` when tracked time, settings, the tracker's status or the tabs permission change.
 * @param {() => void} cb @returns {() => void} unsubscribe
 */
export function onTrackingChanged(cb) {
  /** @param {Record<string, chrome.storage.StorageChange>} changes @param {string} area */
  const listener = (changes, area) => {
    const keys = Object.keys(changes);
    if (area === 'session' ? keys.some((k) => k === 'current' || k === 'error')
      : area === 'local' && keys.some((k) => k === 'settings' || /^(day|imp|hist):/.test(k))) cb();
  };
  const perms = () => cb();
  // @types/chrome 0.0.268 leaves removeListener off these two events; Chrome has it.
  const events = /** @type {chrome.events.Event<() => void>[]} */ (/** @type {unknown} */ ([chrome.permissions.onAdded, chrome.permissions.onRemoved]));
  chrome.storage.onChanged.addListener(listener);
  for (const e of events) e.addListener(perms);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
    for (const e of events) e.removeListener(perms);
  };
}
