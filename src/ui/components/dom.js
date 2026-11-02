// One way to build DOM in Weekly: text is always text. User input and imported
// files never become markup.
/** @template {Element} [T=HTMLElement] @param {string} sel @param {ParentNode} [root] @returns {T} */
export const $ = (sel, root = document) => /** @type {T} */ (root.querySelector(sel));
/** @template {Element} [T=HTMLElement] @param {string} sel @param {ParentNode} [root] @returns {T[]} */
export const $$ = (sel, root = document) => /** @type {T[]} */ (Array.from(root.querySelectorAll(sel)));

/** @param {Node} el */
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// Markup sinks and inline handlers are refused outright: a caller passing one is a bug.
const BLOCKED = new Set(['innerHTML', 'outerHTML', 'srcdoc', 'insertAdjacentHTML', 'setHTMLUnsafe']);
/** @param {string} k */
const isBlocked = (k) => BLOCKED.has(k) || (k !== 'on' && /^on/i.test(k));
// URL-bearing props only accept http(s), mailto, chrome-extension, #fragments and relative paths.
const URL_KEYS = new Set(['href', 'src', 'action', 'formAction']);
const SAFE_URL = /^(?:https?:|mailto:|chrome-extension:|#|[^:]*$)/i;
/** @param {unknown} v */
const safeUrl = (v) => SAFE_URL.test(String(v).trim());
// attrs names are case-insensitive in HTML, so they are checked lowercased.
const BLOCKED_ATTRS = new Set(['srcdoc']);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

/** @typedef {Node | string | number | null | undefined | false | ChildList} Child */
/** @typedef {Array<Child>} ChildList */
/** @typedef {Record<string, unknown> & { class?: string, dataset?: Record<string, string>, style?: Partial<CSSStyleDeclaration>, on?: Record<string, (e: never) => void>, attrs?: Record<string, string | number | boolean> }} Props */

/** @param {HTMLElement} el @param {Record<string, string | number | boolean>} attrs */
function setAttrs(el, attrs) {
  for (const [a, val] of Object.entries(attrs)) {
    const name = a.toLowerCase();
    if (BLOCKED_ATTRS.has(name) || name.startsWith('on')) throw new Error(`h(): attribute "${a}" is not allowed; build DOM from children and use the on: {} prop`);
    if (URL_ATTRS.has(name) && !safeUrl(val)) { console.warn(`[weekly] h(): dropped unsafe ${a}`); continue; }
    el.setAttribute(a, String(val));
  }
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag @param {Props | null} [props] @param {...Child} children
 * @returns {HTMLElementTagNameMap[K]}
 */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (isBlocked(k)) throw new Error(`h(): "${k}" is not allowed; build DOM from children and use the on: {} prop`);
    if (URL_KEYS.has(k) && !safeUrl(v)) { console.warn(`[weekly] h(): dropped unsafe ${k}`); continue; }
    if (k === 'class') el.className = String(v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(/** @type {Record<string, EventListener>} */ (v))) el.addEventListener(ev, fn);
    else if (k === 'attrs') setAttrs(el, /** @type {Record<string, string>} */ (v));
    else /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (el))[k] = v;
  }
  /** @param {Child} c */
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return el;
}
