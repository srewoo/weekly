// The on-page note (spec §3.4; F4): a floating note panel on the page you are on,
// injected only when you ask (Alt+N, or "Note on this page" where Weekly may run).
//
// A self-contained classic script (chrome.scripting.executeScript cannot load
// modules). It lives in a *closed* Shadow DOM, so the page's own scripts and
// styles cannot reach into it, and it builds every node with createElement and
// textContent: no HTML strings. It holds no data of its own: notes come and go
// through the worker (notes:list / notes:save / notes:delete), plain notes only.
// Injecting it again toggles it. Everything lives in one block (block-scoped
// consts, no top-level names, no wrapper function), so a second injection never
// redeclares anything in the extension's isolated world.
if (/** @type {Window & { __weeklyNote?: { toggle: () => void } }} */ (window).__weeklyNote) {
  /** @type {Window & { __weeklyNote?: { toggle: () => void } }} */ (window).__weeklyNote?.toggle();
} else {
  const w = /** @type {Window & { __weeklyNote?: { toggle: () => void } }} */ (window);

  // The same five as lib/note-views.js CATEGORIES (a classic script cannot import it).
  const CATEGORIES = ['General', 'Work', 'Personal', 'Idea', 'To-Read'];
  const CSS = `
:host { all: initial; }
.box { position: fixed; right: 16px; bottom: 16px; width: min(340px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
  overflow: auto; box-sizing: border-box; padding: 12px; display: grid; gap: 8px;
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1c2333;
  background: #fffdf8; border: 1px solid #8f8a7c; border-top: 3px solid #f2cf45; border-radius: 6px; box-shadow: 0 8px 28px rgb(0 0 0 / .18); }
.head { display: flex; justify-content: space-between; align-items: center; }
h2 { margin: 0; font: 600 16px/1.2 Charter, "Iowan Old Style", Georgia, serif; }
input, textarea, select { font: inherit; color: inherit; background: #fffdf8; border: 1px solid #8f8a7c; border-radius: 4px; padding: 5px 7px; box-sizing: border-box; width: 100%; }
textarea { resize: vertical; min-height: 90px; }
.row { display: flex; gap: 6px; align-items: center; }
.row select { flex: 1; }
button { font: inherit; font-weight: 600; cursor: pointer; border-radius: 4px; min-height: 30px; padding: 4px 10px; border: 1px solid #8f8a7c; background: transparent; color: #1f3a68; }
button.primary { background: #1f3a68; border-color: #1f3a68; color: #fffdf8; }
button.quiet { border-color: transparent; padding-inline: 6px; }
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: 2px solid #1f3a68; outline-offset: 2px; }
.msg { margin: 0; font-size: 12px; color: #596071; min-height: 1em; }
ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid #ddd8cb; }
li { display: flex; justify-content: space-between; gap: 6px; border-bottom: 1px solid #ddd8cb; }
li button.open { flex: 1; text-align: left; font-weight: 400; color: #1c2333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dark, .dark input, .dark textarea, .dark select { background: #1c202a; color: #e9e6dd; border-color: #6b7385; }
.dark button { color: #9dbcec; } .dark button:not(.quiet) { border-color: #6b7385; }
.dark button.primary { background: #9dbcec; border-color: #9dbcec; color: #0f1a30; }
.dark li button.open { color: #e9e6dd; } .dark ul, .dark li { border-color: #2d3340; } .dark .msg { color: #a0a7b6; }`;

  /**
   * createElement + properties + text children; never markup.
   * @template {keyof HTMLElementTagNameMap} K
   * @param {K} tag @param {Record<string, unknown>} [props] @param {(Node | string)[]} kids
   * @returns {HTMLElementTagNameMap[K]}
   */
  const el = (tag, props = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'aria') for (const [a, val] of Object.entries(/** @type {Record<string, string>} */ (v))) e.setAttribute(`aria-${a}`, val);
      else /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (e))[k] = v;
    }
    e.append(...kids);
    return e;
  };

  /** @param {string} type @param {Record<string, unknown>} [payload] @returns {Promise<{ ok: boolean } & Record<string, any>>} */
  const ask = async (type, payload = {}) => {
    try {
      return (await chrome.runtime.sendMessage({ type, ...payload })) ?? { ok: false, error: 'Weekly did not answer.' };
    } catch {
      // The extension was reloaded or updated since this page loaded.
      return { ok: false, error: 'Weekly was updated. Reload this page to write a note here.' };
    }
  };

  const host = el('div', { id: 'weekly-note-host' });
  // The page's CSS must not move, hide or show the host: inline, important, reset.
  host.style.cssText = 'all: initial !important; position: fixed !important; z-index: 2147483647 !important;';
  let open = false;
  const root = host.attachShadow({ mode: 'closed' });
  const title = el('input', { type: 'text', maxLength: 200, placeholder: 'Title (optional)', aria: { label: 'Note title' } });
  const body = el('textarea', { maxLength: 20000, placeholder: 'Write a note… (Ctrl+Enter saves)', aria: { label: 'Note' } });
  const category = el('select', { aria: { label: 'Category' } }, ...CATEGORIES.map((c) => el('option', { value: c }, c)));
  const msg = el('p', { className: 'msg', aria: { live: 'polite' } });
  const list = el('ul', { aria: { label: 'Recent notes' } });
  /** The note being edited, or null for a new one. @type {string | null} */
  let editing = null;

  const reset = () => { editing = null; title.value = ''; body.value = ''; category.value = 'General'; };

  /** @param {{ id: string, title: string, body: string, category: string }} n */
  const row = (n) => el('li', {},
    el('button', { type: 'button', className: 'quiet open', onclick: () => {
      editing = n.id; title.value = n.title; body.value = n.body; category.value = n.category; body.focus();
    } }, n.title || n.body.split('\n')[0] || 'Untitled'),
    el('button', { type: 'button', className: 'quiet', aria: { label: `Delete: ${n.title || 'note'}` }, onclick: async () => {
      const r = await ask('notes:delete', { id: n.id });
      msg.textContent = r.ok ? 'Deleted.' : r.error;
      if (editing === n.id) reset();
      await load();
    } }, '✕'));

  const load = async () => {
    const r = await ask('notes:list');
    // Weekly's theme arrives as data (F6): Dark, Light, or the computer's choice for System.
    box.classList.toggle('dark', r.theme === 'dark' || (r.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches));
    list.replaceChildren(...(r.ok ? r.notes.map(row) : []));
    if (!r.ok) msg.textContent = r.error;
  };

  const save = async () => {
    const r = await ask('notes:save', { id: editing ?? undefined, title: title.value, body: body.value, category: category.value });
    msg.textContent = r.ok ? 'Saved in Weekly.' : r.error;
    if (r.ok) { reset(); await load(); body.focus(); }
  };

  const box = el('div', { className: 'box', aria: { label: 'Weekly note' } },
    el('div', { className: 'head' }, el('h2', {}, 'Weekly note'),
      el('button', { type: 'button', className: 'quiet', aria: { label: 'Close' }, onclick: () => setOpen(false) }, '✕')),
    title, body,
    el('div', { className: 'row' }, category,
      el('button', { type: 'button', className: 'quiet', onclick: () => { reset(); body.focus(); } }, 'New'),
      el('button', { type: 'button', className: 'primary', onclick: () => void save() }, 'Save')),
    msg, list);
  box.setAttribute('role', 'dialog');
  root.append(el('style', {}, CSS), box);
  // Keys typed here are the note's: the page's own shortcuts never see them.
  for (const type of ['keyup', 'keypress']) box.addEventListener(type, (e) => e.stopPropagation());
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void save(); }
  });

  /** @param {boolean} next */
  const setOpen = (next) => {
    open = next;
    host.style.setProperty('display', open ? 'block' : 'none', 'important');
    if (open) { void load(); body.focus(); }
  };
  w.__weeklyNote = { toggle: () => {
    // The page removed the note's host: put it back, so Alt+N works without a reload.
    if (!host.isConnected) { (document.body ?? document.documentElement).append(host); setOpen(true); return; }
    setOpen(!open);
  } };
  (document.body ?? document.documentElement).append(host);
  setOpen(true);
}
