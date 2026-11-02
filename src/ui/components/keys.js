// Page-level keyboard shortcuts and the midnight rollover, shared by the side
// panel and the app tab.
import { today } from '../../lib/dates.js';
import { undoLast } from './undo.js';

const NOT_TEXT = new Set(['checkbox', 'radio', 'button', 'submit', 'reset']);
/** A field that takes keystrokes. A focused checkbox does not, so N or ⌘Z still work after a tick. @param {EventTarget | null} t */
export const isTyping = (t) => t instanceof HTMLElement && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName)
  || (t instanceof HTMLInputElement && !NOT_TEXT.has(t.type)));

/** Close every open ⋯ menu; if focus was inside one, put it back on that menu's summary. */
function closeMenus() {
  document.querySelectorAll('details.more[open]').forEach((d) => {
    const hadFocus = d.contains(document.activeElement);
    d.removeAttribute('open');
    if (hadFocus) d.querySelector('summary')?.focus();
  });
}

/**
 * Single-key shortcuts (N, /, O, T, arrows…) fire only when no field has focus
 * and no modifier is held. ⌘Z / Ctrl+Z undoes the last action outside fields,
 * where the browser's own text undo belongs. Esc closes any open ⋯ menu; open
 * dialogs close themselves on Esc.
 * @param {Record<string, (e: KeyboardEvent) => void>} map keyed by KeyboardEvent.key, letters lowercase
 */
export function bindKeys(map) {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenus();
    if (isTyping(e.target)) return;
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); void undoLast(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    const fn = map[e.key.length === 1 ? e.key.toLowerCase() : e.key];
    if (fn) { e.preventDefault(); fn(e); }
  });
}

/**
 * Call `cb` when the page comes back after midnight (spec L10): a panel or tab
 * left open overnight must stop calling yesterday "today".
 * @param {() => void} cb
 */
export function onNewDay(cb) {
  let day = today();
  const check = () => {
    if (document.visibilityState !== 'visible' || today() === day) return;
    day = today();
    cb();
  };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
}
