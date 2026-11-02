// The unlock dialog (F3): one <dialog>, built once with h(). It resolves true once
// the worker has unlocked, false on Cancel or Esc. A wrong PIN and the lockout are
// said in words; the PIN field is cleared after every try.
import { h } from './dom.js';
import { unlock, explain } from './private.js';

/** @type {{ dlg: HTMLDialogElement, pin: HTMLInputElement, err: HTMLElement } | null} */
let ui = null;
/** @type {((ok: boolean) => void) | null} */
let settle = null;

/** @param {boolean} ok */
function finish(ok) {
  const s = settle;
  settle = null;
  if (ui?.dlg.open) ui.dlg.close();
  s?.(ok);
}

function build() {
  const pin = h('input', { type: 'password', id: 'unlockPin', inputMode: 'numeric', autocomplete: 'off', maxLength: 8, attrs: { 'aria-label': 'PIN' } });
  const go = h('button', { class: 'primary', id: 'unlockGo' }, 'Unlock');
  const err = h('p', { id: 'unlockErr', class: 'msg', attrs: { role: 'alert' } });
  const form = h('form', { on: { submit: async (/** @type {SubmitEvent} */ e) => {
    e.preventDefault();
    go.disabled = true;   // one check at a time: a double submit must not count one wrong PIN twice
    const r = await unlock(pin.value);
    go.disabled = false;
    pin.value = '';
    if (r.ok) finish(true);
    else { err.textContent = explain(r); pin.focus(); }
  } } },
  h('h2', { id: 'unlockHead' }, 'Unlock private notes'),
  h('p', { class: 'hint' }, 'Private notes stay open until you lock them. They also lock after 5 minutes without use, or sooner if Chrome pauses Weekly in the background.'),
  pin, err,
  h('div', { class: 'dlg-foot' },
    h('button', { type: 'button', on: { click: () => finish(false) } }, 'Cancel'),
    go));
  const dlg = h('dialog', { id: 'unlockDialog', attrs: { 'aria-labelledby': 'unlockHead' } }, form);
  dlg.addEventListener('close', () => finish(false));
  document.body.append(dlg);
  return { dlg, pin, err };
}

/** @returns {Promise<boolean>} true once unlocked */
export function askPin() {
  ui ??= build();
  ui.err.textContent = '';
  ui.pin.value = '';
  if (!ui.dlg.open) ui.dlg.showModal();
  ui.pin.focus();
  return new Promise((resolve) => { settle = resolve; });
}
