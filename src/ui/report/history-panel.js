// Filling untracked days from Chrome history: the banner. (The Settings page has the same buttons.)
import { $ } from '../components/dom.js';
import { shiftDate } from '../../lib/week.js';
import { HISTORY_DAYS, fillFromHistory } from '../components/history-fill.js';
import { WEEKDAYS } from '../../lib/report/draft.js';
import { msg, load } from './main.js';

// Offer history for past days in the 15-day window that have nothing tracked and weren't checked yet.
export function renderHistBanner(W) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const gaps = W.sample ? [] : W.days.map((d, i) => i).filter(i => W.days[i] <= today && W.days[i] > shiftDate(today, -HISTORY_DAYS) && !W.perDay[i] && !W.histTried[i]);
  $('#histBanner').hidden = !gaps.length;
  msg('#histText', `Nothing tracked on ${gaps.map(i => WEEKDAYS[i]).join(', ')}. Fill those days in from your Chrome history? Times will be estimates.`);
  $('#estHint').hidden = !W.estimated.some(Boolean);
}

export function init() {
  $('#histBtn').onclick = () => fillFromHistory('#histMsg', () => load(false));
}
