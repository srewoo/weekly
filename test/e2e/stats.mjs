// Stats and the daily tasks list (spec L6, L7). Dates are computed in Node and passed
// in; sw.evaluate callbacks use only chrome.*, built-ins and their argument (R1).
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return isoOf(d); };

// A daily task from 20 days ago, ticked on the last 10 days: 10 of 21 days.
const PROBE = 'Stats probe';
const seedProbe = (sw) => sw.evaluate(({ title, from, done }) => chrome.storage.local.get('tasks').then(({ tasks = [] }) => chrome.storage.local.set({ tasks: [...tasks,
  { id: 't_statsprobe1', title, description: '', priority: 'medium', dueDate: null, status: 'open', createdAt: 1, updatedAt: 1, completedAt: null,
    repeat: { days: [0, 1, 2, 3, 4, 5, 6], from, until: null }, doneDates: done }] })),
{ title: PROBE, from: daysAgo(20), done: Array.from({ length: 10 }, (_, i) => daysAgo(9 - i)) });

export async function statsChecks(t) {
  const { ctx, X, sw, check, watch, wait, PAGES, iso, shots } = t;
  await seedProbe(sw);
  const setStats = (on) => sw.evaluate(async (showStats) => { const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, showStats } }); }, on);
  const app = watch(await ctx.newPage());
  await setStats(false);
  await app.goto(`${X}/${PAGES.app}#stats`); await wait(900);
  check('Stats', 'Stats is off by default: no nav item, and #stats shows the calendar', await app.locator('#nav-stats').count() === 0 && !(await app.isVisible('#view-stats')) && await app.isVisible('#view-calendar')
    && (await app.locator('#mainNav a').allTextContents()).join() === 'Update,Tasks,Calendar,Notes,Settings');
  await setStats(true);
  // The nav reads showStats once per page load, and with Stats off the app rewrote the hash to #calendar:
  // leave the page so the next goto is a real load.
  await app.goto('about:blank'); await app.goto(`${X}/${PAGES.app}#stats`); await wait(900);
  check('Stats', '#stats opens the Stats view with six figures (L7)', await app.isVisible('#view-stats') && await app.locator('#statFigures .figure').count() === 6
    && (await app.getAttribute('#nav-stats', 'aria-current')) === 'page');
  const cells = await app.locator('#heatmap .hm-cell:not(.blank)').count();
  const months = (await app.locator('#hmMonths span').allTextContents()).filter(Boolean);
  const todayCell = await app.getAttribute(`#heatmap .hm-cell[data-iso="${iso.today}"]`, 'title');
  check('Stats', 'a year of days: 365 squares ending today, months labelled (L7)', cells === 365 && months.length >= 12 && / of \d+ done/.test(todayCell ?? ''), `${cells} ${months.join(',')} ${todayCell}`);
  const wd = (await app.locator('#weekdayBars .wd-row span:first-child').allTextContents()).join(',');
  check('Stats', 'weekday bars run Monday to Sunday (L7)', wd === 'Mon,Tue,Wed,Thu,Fri,Sat,Sun', wd);
  const probe = app.locator('#dailyRates li', { hasText: PROBE });
  check('Stats', 'per-task rate counts the days it was due: 10 of 21, 48% (L7)', /10 of 21 days/.test(await probe.textContent()) && (await probe.locator('.wd-pct').textContent()) === '48%', await probe.textContent());
  await app.screenshot({ path: shots + '/stats.png', fullPage: true });
  await app.setViewportSize({ width: 400, height: 900 }); await wait(200);
  check('Layout', 'Stats: no sideways scrolling at phone width; the year scrolls in its own strip', await app.evaluate(() => document.documentElement.scrollWidth <= 400));
  await app.setViewportSize({ width: 1280, height: 900 });
  await dailyTaskChecks(t, app);
  await setStats(false);  // back to the default, so later checks see the shipped nav
  await app.close();
}

async function dailyTaskChecks(t, app) {
  const { check, store, wait } = t;
  const probeTask = async () => ((await store()).tasks ?? []).find((x) => x.id === 't_statsprobe1');
  const aria = (sel) => app.locator(sel, { hasText: PROBE }).locator('button').first().getAttribute('aria-label');
  check('Daily tasks', 'Stop repeating names its task for a screen reader (T2-a)', (await aria('#dailyRates li')) === `Stop repeating ${PROBE}`, await aria('#dailyRates li'));
  await app.locator('#dailyRates li', { hasText: PROBE }).locator('button.stop').click(); await wait(500);
  const stopped = await probeTask();
  check('Daily tasks', 'Stop repeating keeps its history and moves it to Stopped (L6)', stopped?.repeat?.until === daysAgo(1) && stopped.doneDates.length === 10
    && await app.isVisible('#stoppedWrap') && await app.locator('#stoppedList li', { hasText: PROBE }).count() === 1, JSON.stringify(stopped?.repeat));
  await app.click('#stoppedWrap summary');
  check('Daily tasks', 'Repeat again names its task for a screen reader (T2-a)', (await aria('#stoppedList li')) === `Repeat ${PROBE} again`, await aria('#stoppedList li'));
  await app.locator('#stoppedList li', { hasText: PROBE }).locator('button.restart').click(); await wait(500);
  check('Daily tasks', 'Repeat again brings it back (L6)', (await probeTask())?.repeat?.until === null && await app.locator('#dailyRates li', { hasText: PROBE }).count() === 1);
  app.once('dialog', (d) => d.dismiss());
  await app.locator('#dailyRates li', { hasText: PROBE }).locator('button.purge').click(); await wait(400);
  check('Daily tasks', 'Delete asks first; Cancel keeps the task (L6)', !!(await probeTask()));
  app.once('dialog', (d) => d.accept());
  await app.locator('#dailyRates li', { hasText: PROBE }).locator('button.purge').click(); await wait(500);
  const gone = !(await probeTask()) && await app.locator('#dailyRates li', { hasText: PROBE }).count() === 0;
  await app.click('.toast button'); await wait(500);
  const back = await probeTask();
  check('Daily tasks', 'Delete for good removes it and its ticks; Undo puts it back whole (L6)', gone && back?.doneDates.length === 10, JSON.stringify(back?.repeat));
  app.once('dialog', (d) => d.accept());
  await app.locator('#dailyRates li', { hasText: PROBE }).locator('button.purge').click(); await wait(500);
  const { unlabeled } = await import('./panel.mjs');
  check('Layout', 'every Stats control has a label', !(await probeTask()) && (await unlabeled(app)).length === 0, (await unlabeled(app)).join(', '));
}
