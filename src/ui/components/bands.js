// Labelled bands of task rows. A collapsible band is a native <details>, so it
// opens with the keyboard for free; its state is reported through onToggle.
import { h, clear } from './dom.js';

/**
 * @typedef {object} BandLike
 * @property {string} label
 * @property {import('../../lib/tasks.js').Task[]} tasks
 * @property {boolean} [flagged]
 * @property {string} [key]
 * @property {boolean} [collapsible]
 * @property {boolean} [defaultOpen]
 */

/**
 * @param {HTMLElement} host
 * @param {BandLike[]} bands
 * @param {(t: import('../../lib/tasks.js').Task) => HTMLElement} row
 * @param {{ isOpen?: (b: BandLike) => boolean, onToggle?: (key: string, open: boolean) => void, action?: (b: BandLike) => HTMLElement | null, empty?: string }} [opts]
 */
export function renderBands(host, bands, row, opts = {}) {
  clear(host);
  for (const b of bands) {
    const list = b.tasks.length ? h('ul', { class: 'rows' }, b.tasks.map(row)) : h('p', { class: 'none' }, opts.empty ?? 'Nothing here.');
    const head = [h('span', { class: 'band-label' }, b.label), h('span', { class: 'band-count' }, b.tasks.length ? String(b.tasks.length) : '–')];
    const cls = ['band', b.flagged && 'flagged'].filter(Boolean).join(' ');
    if (b.collapsible && b.key) {
      const key = b.key;
      let shown = opts.isOpen?.(b) ?? b.defaultOpen ?? true;
      // Setting `open` fires a toggle event too; report only the user's changes.
      const onToggle = (/** @type {Event} */ e) => {
        const now = /** @type {HTMLDetailsElement} */ (e.target).open;
        if (now !== shown) { shown = now; opts.onToggle?.(key, now); }
      };
      host.append(h('details', { class: cls, open: shown, dataset: { band: key }, on: { toggle: onToggle } },
      h('summary', {}, head), list));
    } else {
      host.append(h('section', { class: cls, dataset: { band: b.key ?? b.label } },
        h('h3', {}, head, opts.action?.(b) ?? null), list));
    }
  }
}
