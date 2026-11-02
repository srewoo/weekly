// Read-only rendered view of the draft Markdown (parsed by lib/report/formats.js). Built with h(), never innerHTML.
import { h, clear } from '../components/dom.js';
import { parse, inline, clampDepth, italicLine, splitTags } from '../../lib/report/formats.js';

/** @param {string} s */
function spans(s) {
  return inline(s).flatMap(p => {
    if (p.t === 'link') return [h('a', { href: p.url, target: '_blank', rel: 'noopener' }, p.text)];
    if (p.t === 'bold') return [h('strong', {}, p.text)];
    return splitTags(p.text).map(x => (x.tag ? h('span', { class: 'tag' }, x.text) : x.text));
  });
}

/** @param {string} md @returns {HTMLElement[]} */
export function previewNodes(md) {
  /** @type {HTMLElement[]} */
  const out = [];
  /** @type {HTMLElement[]} */
  let lists = [];      // open <ul>s, outermost first
  for (const b of clampDepth(parse(md))) {
    if (b.kind !== 'li') {
      lists = [];
      if (b.kind === 'h') out.push(h(`h${Math.min(Math.max(b.level, 2), 4) + 1}`, {}, spans(b.text)));
      else { const it = italicLine(b.text); out.push(h('p', {}, it === null ? spans(b.text) : h('em', {}, it))); }
      continue;
    }
    lists.length = Math.min(lists.length, b.depth + 1);
    if (!lists[b.depth]) {
      const ul = h('ul', {});
      if (b.depth === 0) out.push(ul); else /** @type {HTMLElement} */ (lists[b.depth - 1]?.lastElementChild).append(ul);
      lists[b.depth] = ul;
    }
    /** @type {HTMLElement} */ (lists[b.depth]).append(h('li', {}, spans(b.text)));
  }
  return out;
}

/** @param {HTMLElement} el @param {string} md */
export function renderPreview(el, md) { clear(el); el.append(...previewNodes(md)); }
