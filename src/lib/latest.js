// Last-call-wins guard for overlapping async loads: call `guard()` when a load
// starts; after each await, `if (!mine()) return;` drops a load that a newer one replaced.
/** @returns {() => () => boolean} */
export function latest() {
  let n = 0;
  return () => { const me = ++n; return () => me === n; };
}
