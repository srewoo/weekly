/**
 * The on-page note's worker side (spec §3.4, §5; F4).
 *
 * The note is injected on demand into the active tab with `activeTab` +
 * `scripting`: no host permissions and no content script on every page. Chrome
 * grants activeTab for Alt+N (a command), not for a click inside the side panel,
 * so the panel's "Note on this page" works where Weekly already may run (a site
 * the user allowed for live statuses) and otherwise points to Alt+N or the
 * Notes tab. Where Chrome keeps scripts out (its own pages, the Web Store), the
 * side panel opens on Notes instead.
 *
 * The page's script reads and writes notes only through notes:* messages, and
 * only plain ones: private notes never enter a web page's process, locked or not.
 */
import { isOurs, isOwnPage } from './sender.js';
import { getNotes, createNote, updateNote, deleteNote, sortNotes } from '../lib/notes.js';
import { getSettings } from '../lib/settings.js';

/** @typedef {import('../lib/notes.js').Note} Note */
/** @typedef {Record<string, unknown>} Msg */
/** @typedef {{ ok: boolean } & Record<string, unknown>} Reply */

export const CONTENT_SCRIPT = 'src/content/onpage-note.js';
const LIST_MAX = 8;
const ID = /^[\w-]{1,64}$/;
/** The tab the side panel should show next time it asks (panel:hello). @type {string | null} */
let pendingTab = null;

/** @param {unknown} url */
export const canInject = (url) => typeof url === 'string' && /^(https?|file):/i.test(url)
  && !/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url);

/** @param {number} tabId @returns {Promise<boolean>} */
export async function inject(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT] });
    return true;
  } catch (e) {
    console.warn('[weekly] no on-page note here; the side panel’s Notes tab is the fallback', e);
    return false;
  }
}

/** Open the side panel on Notes. sidePanel.open is the first call: it needs the user gesture. @param {number | undefined} windowId */
function openNotesPanel(windowId) {
  if (windowId === undefined) return;
  pendingTab = 'notes';
  // pendingTab never outlives the fallback: an open that failed clears it; panel:hello consumes it. (Any extension page may answer panel:show, so a reply proves nothing about the panel.)
  chrome.sidePanel.open({ windowId }).catch((e) => { pendingTab = null; console.error('[weekly] side panel', e); });
  // A panel that is already open switches at once; one that is opening asks with panel:hello.
  chrome.runtime.sendMessage({ type: 'panel:show', tab: 'notes' }).catch(() => undefined);
}

/**
 * Alt+N. Called straight from commands.onCommand, so nothing is awaited before
 * executeScript or sidePanel.open (the gesture would be gone).
 * @param {chrome.tabs.Tab | undefined} tab
 */
export function onNoteCommand(tab) {
  if (tab?.id === undefined) return;
  // Without the `tabs` permission Chrome may omit tab.url (or give ''): try the injection anyway (activeTab covers this tab) and fall back if it throws.
  if (tab.url && !canInject(tab.url)) { openNotesPanel(tab.windowId); return; }
  const windowId = tab.windowId;
  // ponytail: a refusal found only after the await (a PDF, an error page) may have lost the gesture; the open is best effort.
  void inject(tab.id).then((ok) => { if (!ok) openNotesPanel(windowId); });
}

/** What a web page may see of a note. @param {Note} n */
const forPage = (n) => ({ id: n.id, title: n.title, body: n.body, category: n.category });
/** @param {unknown} id @returns {Promise<Note | null>} the plain note with this id */
const plainNote = async (id) => (typeof id === 'string' ? (await getNotes()).find((n) => n.id === id && !n.enc) ?? null : null);
const REFUSED = { ok: false, error: 'That note can’t be changed here.' };

/** @param {Msg} m @returns {Promise<Reply>} */
async function save(m) {
  // Only these three fields are read: a page can neither set `enc` nor reach a private note.
  const draft = { title: String(m['title'] ?? ''), body: String(m['body'] ?? ''), category: String(m['category'] ?? 'General') };
  if (m['id'] !== undefined) {
    if (!(await plainNote(m['id']))) return REFUSED;
    // updateNote validates the category (coerceNote), so the page's string is safe to pass.
    return { ok: !!(await updateNote(/** @type {string} */ (m['id']), /** @type {Partial<Note>} */ (/** @type {unknown} */ (draft)))) };
  }
  const n = await createNote(draft);
  return n ? { ok: true, id: n.id } : { ok: false, error: 'Write something first.' };
}

/** @type {Record<string, (m: Msg, sender: chrome.runtime.MessageSender) => Promise<Reply>>} */
const OPS = {
  // The theme travels as data: a web page cannot load Weekly's stylesheet (F6).
  'notes:list': async () => ({ ok: true, theme: (await getSettings()).theme,
    notes: sortNotes((await getNotes()).filter((n) => !n.enc)).slice(0, LIST_MAX).map(forPage) }),
  'notes:save': save,
  'notes:delete': async (m) => ((await plainNote(m['id'])) ? (await deleteNote(/** @type {string} */ (m['id'])), { ok: true }) : REFUSED),
  'panel:openOnPage': async (m) => {
    const [tab] = typeof m['windowId'] === 'number' ? await chrome.tabs.query({ active: true, windowId: m['windowId'] }) : [];
    return { ok: tab?.id !== undefined && await inject(tab.id) };
  },
  'panel:hello': async () => { const tab = pendingTab; pendingTab = null; return { ok: true, tab }; },
};
// Asked by Weekly's own pages only, never by a content script in a web page.
const PAGE_ONLY = new Set(['panel:openOnPage', 'panel:hello']);

/**
 * Answer a notes:* or panel:* message. Only this extension may ask (a content
 * script carries its id); panel:* only from its own pages.
 * @param {unknown} msg @param {chrome.runtime.MessageSender} sender @returns {Promise<Reply>}
 */
export async function handle(msg, sender) {
  const m = /** @type {Msg} */ (typeof msg === 'object' && msg !== null ? msg : {});
  const type = String(m['type']);
  if (!isOurs(sender) || (PAGE_ONLY.has(type) && !isOwnPage(sender))) return { ok: false, error: 'Not allowed.' };
  if (!Object.hasOwn(OPS, type)) return { ok: false, error: 'Unknown request.' };
  if (m['id'] !== undefined && !ID.test(String(m['id']))) return REFUSED;
  return /** @type {(m: Msg, s: chrome.runtime.MessageSender) => Promise<Reply>} */ (OPS[type])(m, sender);
}
