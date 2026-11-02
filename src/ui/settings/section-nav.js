// Marks the section nav link of the section in view (aria-current) as you scroll.
import { $$ } from '../components/dom.js';

export function init() {
  const links = $$('.jump a');
  const mark = id => links.forEach(a => (a.getAttribute('href') === `#${id}`
    ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  const secs = $$('main > .sec');
  if (!secs.length || typeof IntersectionObserver === 'undefined') return;
  const seen = new Set();
  const io = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id);
    const first = secs.find(s => seen.has(s.id));
    if (first) mark(first.id);
  }, { rootMargin: '0px 0px -60% 0px' });
  secs.forEach(s => io.observe(s));
  mark(secs[0].id);
}
