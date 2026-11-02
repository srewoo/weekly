// Says something in a status line (a role="status" element), by selector.
import { $ } from './dom.js';

/** @param {string} sel @param {string} text */
export const msg = (sel, text) => ($(sel).textContent = text);
