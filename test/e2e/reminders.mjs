// Reminders (spec §3.3; D7, D8, D9): the reminder window, the alarms that open it,
// its settings and the keyboard commands. Dates are computed here in Node and
// passed in; sw.evaluate callbacks use only chrome.* and their argument (R1).

/** A one-off task as storage holds it. */
const oneOff = (id, title, dueDate) => ({ id, title, description: '', priority: 'medium', dueDate, status: 'open',
  createdAt: Date.now(), updatedAt: Date.now(), completedAt: null, repeat: null, doneDates: [] });

/** Add tasks, and set reminder settings, straight into storage. */
export const seed = (sw, { tasks = [], settings = {} }) => sw.evaluate(async ({ add, patch }) => {
  const st = await chrome.storage.local.get(['tasks', 'settings']);
  await chrome.storage.local.set({ tasks: [...(st.tasks ?? []), ...add], settings: { ...(st.settings ?? {}), ...patch } });
}, { add: tasks, patch: settings });

const task = async (store, id) => ((await store()).tasks ?? []).find(x => x.id === id);

/** Reminders link to app.html#day=…; a malformed day must land on the calendar, not a broken sheet. */
async function badDayCheck(t) {
  const { ctx, X, check, watch, wait, PAGES } = t;
  const page = watch(await ctx.newPage());
  await page.goto(`${X}/${PAGES.app}#day=2026-13-45`); await wait(600);
  const shown = await page.evaluate(() => ({ cal: !document.querySelector('#view-calendar').hidden, tasks: !document.querySelector('#view-tasks').hidden, sheet: document.querySelector('#daySheet').open }));
  check('App', 'an invalid #day= falls back to the calendar', shown.cal && !shown.tasks && !shown.sheet, JSON.stringify(shown));
  await page.close();
}

// The window's page, opened directly as an extension URL (the worker opens it from Task 4 on).
export async function reminderWindowChecks(t) {
  const { ctx, X, sw, check, watch, store, wait, PAGES, iso } = t;
  const c = (name, ok, detail) => check('Reminder', name, ok, detail);
  // Today is the only working day, so it is also the last one: the evening carries the weekly-update nudge.
  await seed(sw, { tasks: [oneOff('rem-late', 'Send the invoice', iso.yesterday), oneOff('rem-due', 'Review the PR', iso.today)],
    settings: { days: [new Date().getDay()] } });
  const win = watch(await ctx.newPage());
  await win.goto(`${X}/${PAGES.remind}?slot=evening`); await wait(800);
  const inBand = (band, title) => win.locator(`[data-band="${band}"] li.row`, { hasText: title }).count();
  c('evening check: Carried over, then Today (D8)', await inBand('overdue', 'Send the invoice') === 1 && await inBand('today', 'Review the PR') === 1
    && /still open\.$/.test(await win.textContent('#headline')), await win.textContent('#headline'));
  await win.locator('li.row', { hasText: 'Review the PR' }).locator('button.later').click(); await wait(500);
  c('Move to tomorrow on one task (D7)', (await task(store, 'rem-due')).dueDate === iso.tomorrow && await inBand('today', 'Review the PR') === 0);
  await win.click('#moveAll'); await wait(500);
  c('Move all to tomorrow (D7)', (await task(store, 'rem-late')).dueDate === iso.tomorrow && await win.locator('[data-band="overdue"]').count() === 0);
  await win.click('.toast button'); await wait(500);
  c('Move all is undoable', (await task(store, 'rem-late')).dueDate === iso.yesterday);
  const unlabeled = await win.evaluate(() => [...document.querySelectorAll('input,select,button')].filter(el => !el.hidden && !(el.labels?.length) && !el.getAttribute('aria-label') && !el.textContent.trim()).length);
  check('Layout', 'every reminder-window control has a label', unlabeled === 0, unlabeled);
  c('last working day: the evening leads with the ready update', await win.isVisible('#weekNudge') && /Your weekly update is ready/.test(await win.textContent('#readyLine')) && !(await win.isVisible('#progress')), await win.textContent('#readyLine'));
  const [rep2] = await Promise.all([ctx.waitForEvent('page'), win.click('#openReport')]);
  await rep2.waitForLoadState(); await wait(300);
  c('"Open the week report" opens the report and closes the window', rep2.url().endsWith('/' + PAGES.report) && win.isClosed(), rep2.url());
  await rep2.close();
  const brief = watch(await ctx.newPage());
  await brief.goto(`${X}/${PAGES.remind}?slot=morning`); await wait(800);
  c('morning brief: what is due, no Move all, no progress line (today is the last working day, so it leads with the update)', /due today\.$/.test(await brief.textContent('#headline')) && !(await brief.isVisible('#moveAll')) && !(await brief.isVisible('#progress')), await brief.textContent('#headline'));
  const [app] = await Promise.all([ctx.waitForEvent('page'), brief.click('#openApp')]);
  await app.waitForLoadState(); await wait(600);
  c('"Open Weekly" opens that day in the app', app.url().endsWith(`/${PAGES.app}#day=${iso.today}`) && await app.evaluate(() => document.querySelector('#daySheet').open), app.url());
  await app.close();
  await badDayCheck(t);
  await seed(sw, { settings: { days: [1, 2, 3, 4, 5] } });
}

const popups = sw => sw.evaluate(() => chrome.windows.getAll({ windowTypes: ['popup'] }));
/** Fire a reminder alarm now; with `opens`, wait for the reminder window page it opens. */
async function fireAlarm(t, name, opens) {
  const { ctx, sw, wait } = t;
  const fired = sw.evaluate(n => chrome.alarms.create(n, { when: Date.now() + 100 }), name);
  if (!opens) { await fired; await wait(1500); return null; }
  const [page] = await Promise.all([ctx.waitForEvent('page', { predicate: p => p.url().includes(opens), timeout: 8000 }), fired]);
  await page.waitForLoadState(); await wait(800);
  return t.watch(page);
}

// The worker's side: one-shot alarms, the one reused window, the notification, once a day, snooze.
export async function reminderEngineChecks(t) {
  const { sw, check, store, wait, iso } = t;
  const c = (name, ok, detail) => check('Reminders', name, ok, detail);
  await seed(sw, { settings: { morning: { enabled: true, time: '09:00' }, evening: { enabled: true, time: '18:00' }, days: [new Date().getDay()] } });
  await sw.evaluate(() => chrome.storage.local.remove('reminderState')); await wait(500);
  const at = async name => { const a = await sw.evaluate(n => chrome.alarms.get(n), name); return a && { ...a, d: new Date(a.scheduledTime) }; };
  const [m, e] = [await at('weekly:morning'), await at('weekly:evening')];
  c('one-shot alarms at 09:00 and 18:00, no repeat period (D8)', m && e && !m.periodInMinutes && !e.periodInMinutes && m.d > new Date() && e.d > new Date()
    && m.d.getHours() === 9 && m.d.getMinutes() === 0 && e.d.getHours() === 18 && e.d.getMinutes() === 0, JSON.stringify([m, e]));
  const win = await fireAlarm(t, 'weekly:evening', 'slot=evening');
  c('the evening alarm opens the reminder window, a popup (D8)', (await popups(sw)).length === 1 && await win.locator('li.row', { hasText: 'Send the invoice' }).count() === 1);
  c('with a system notification (D9)', Object.keys(await sw.evaluate(() => chrome.notifications.getAll())).includes('weekly:remind:evening'));
  const next = await at('weekly:evening');
  c('the fired alarm chains the next one, again at 18:00', next && next.d > new Date() && next.d.getHours() === 18, JSON.stringify(next));
  c('the check is marked shown for today', (await store()).reminderState?.eveningLastShown === iso.today, JSON.stringify((await store()).reminderState));
  await fireAlarm(t, 'weekly:morning');
  c('the morning brief reuses the same window (D9)', (await popups(sw)).length === 1 && win.url().includes('slot=morning'), win.url());
  await fireAlarm(t, 'weekly:evening');
  c('a slot shows at most once a day', win.url().includes('slot=morning'), win.url());
  await win.evaluate(() => chrome.runtime.sendMessage({ type: 'reminder:preview', slot: 'evening' })); await wait(1200);
  await win.click('#snooze'); await wait(800);
  const snoozed = await at('weekly:snooze');
  c('Snooze 1 h closes the window and brings the check back in an hour', win.isClosed() && snoozed && Math.abs(snoozed.scheduledTime - Date.now() - 3_600_000) < 60_000, JSON.stringify(snoozed));
  const again = await fireAlarm(t, 'weekly:snooze', 'slot=evening');
  c('the snoozed check comes back in a new window once the old one is gone', !!again && (await popups(sw)).length === 1);
  await again.click('#dismiss'); await wait(600);
  c('Dismiss closes the window and the worker forgets it', again.isClosed() && !(await sw.evaluate(() => chrome.storage.session.get('reminderWindowId'))).reminderWindowId);
  const left = Object.keys(await sw.evaluate(() => chrome.notifications.getAll())).filter((id) => id.startsWith('weekly:remind:'));
  c('the notification goes with the window: none is left in the notification centre (Phase 3 m2)', left.length === 0, left.join(', '));
  // Off again, so a real 09:00 or 18:00 can never open a window in the middle of the rest of the suite.
  await seed(sw, { settings: { morning: { enabled: false, time: '09:00' }, evening: { enabled: false, time: '18:00' }, days: [1, 2, 3, 4, 5] } });
}

// Settings → Reminders, on the report page (spec §3.2; D8).
export async function reminderSettingsChecks(t) {
  const { ctx, sw, check, store, wait } = t;
  const rep = await t.toSettings();   // a fresh load: the form is filled on load, and reminders.mjs changed storage since
  const c = (name, ok, detail) => check('Settings', name, ok, detail);
  const days = await rep.locator('#remindDays input:checked').evaluateAll(els => els.map(e => e.value).join(','));
  c('Reminders group shows the stored times and working days', await rep.inputValue('#morningTime') === '09:00' && await rep.inputValue('#eveningTime') === '18:00'
    && days === '1,2,3,4,5' && !(await rep.isChecked('#morningOn')), days);
  await rep.check('#morningOn'); await rep.fill('#morningTime', '08:30');
  await rep.check('#eveningOn'); await rep.fill('#eveningTime', '17:45');
  await rep.uncheck('#remindDays input[value="5"]'); await rep.uncheck('#systemNotification');
  await wait(1300);
  const s = (await store()).settings;
  c('reminder times, working days and notification saved (D8)', s.morning.enabled && s.morning.time === '08:30' && s.evening.enabled && s.evening.time === '17:45'
    && s.days.join() === '1,2,3,4' && s.systemNotification === false, JSON.stringify(s));
  const at = n => sw.evaluate(name => chrome.alarms.get(name), n).then(a => a && new Date(a.scheduledTime));
  const [m, e] = [await at('weekly:morning'), await at('weekly:evening')];
  c('the alarms move to the new times at once', m?.getHours() === 8 && m.getMinutes() === 30 && e?.getHours() === 17 && e.getMinutes() === 45, `${m} ${e}`);
  const shown = (await store()).reminderState;
  const [win] = await Promise.all([ctx.waitForEvent('page', { predicate: p => p.url().includes('slot=evening'), timeout: 8000 }), rep.click('#previewEvening')]);
  await win.waitForLoadState(); await wait(600);
  c('Preview opens the reminder window and leaves today’s schedule alone', JSON.stringify((await store()).reminderState) === JSON.stringify(shown)
    && (await at('weekly:evening'))?.getTime() === e?.getTime());
  await win.click('#dismiss'); await wait(400);
  await rep.fill('#morningTime', ''); await wait(1300);
  c('a cleared reminder time is refused in words, not saved as the default', /Enter a time for the morning brief/.test(await rep.textContent('#reminderErr'))
    && (await store()).settings.morning.time === '08:30', await rep.textContent('#reminderErr'));
  await rep.fill('#morningTime', '08:30');
  // Back to off for the rest of the suite (a real 08:30 or 17:45 must not open a window mid-run).
  await rep.uncheck('#morningOn'); await rep.uncheck('#eveningOn');
  await rep.check('#remindDays input[value="5"]'); await rep.check('#systemNotification');
  await wait(1300);
}

// Keyboard commands (D10). Chrome registers them from the manifest; pressing them is browser UI that
// a headless page cannot reach, so the handlers are unit-tested (service-worker.test.js).
export async function commandChecks(t) {
  const { sw, check } = t;
  const cmds = Object.fromEntries((await sw.evaluate(() => chrome.commands.getAll())).map(c => [c.name, c.shortcut]));
  check('Commands', 'Alt+T opens the side panel and Alt+Shift+T the app: both registered (D10)',
    /^(Alt|⌥)\+?T$/.test(cmds['open-panel'] ?? '') && /^(Alt\+Shift|⇧⌥|⌥⇧)\+?T$/.test(cmds['open-app'] ?? ''), JSON.stringify(cmds));
}
