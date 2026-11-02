// The app tab (spec §3.2): Calendar, day sheet, Tasks view, keys and links (D3–D6, D10, L1–L5, L9).
export async function calendarChecks(t, pan) {
  const { ctx, check, watch, wait, PAGES, iso } = t;
  await pan.bringToFront(); await pan.evaluate(() => document.activeElement?.blur());
  const [app] = await Promise.all([ctx.waitForEvent('page'), pan.keyboard.press('o')]);
  watch(app); await app.waitForLoadState(); await wait(800);
  check('Keys', 'O in the side panel opens the full app', app.url().includes('/' + PAGES.app), app.url());
  check('App', 'opens on the Calendar', await app.isVisible('#calGrid') && app.url().endsWith('#calendar'), app.url());
  check('Calendar', 'month grid starts on Monday, today ringed', (await app.locator('.cal-labels span').first().textContent()) === 'Mon' && await app.locator(`.cal-day.today[data-iso="${iso.today}"]`).count() === 1);
  const title0 = await app.textContent('#calTitle');
  await app.keyboard.press('ArrowRight'); await wait(200);
  const nextDays = await app.locator('.cal-day').count();
  check('Calendar', 'next month: every day is muted as future (L4)', (await app.textContent('#calTitle')) !== title0 && await app.locator('.cal-day.future').count() === nextDays);
  await app.keyboard.press('ArrowLeft'); await app.keyboard.press('ArrowLeft'); await wait(200);
  const prevTitle = await app.textContent('#calTitle');
  await app.keyboard.press('t'); await wait(200);
  check('Keys', '← → change month, T jumps to today (L9)', prevTitle !== title0 && (await app.textContent('#calTitle')) === title0);
  return app;
}

// The day sheet: daily tasks, extra tasks, move, copy, note slot, Esc, Stop repeating, #day= route.
export async function daySheetChecks(t, app, pan) {
  const { X, check, store, wait, shots, PAGES, iso } = t;
  const byTitle = async title => ((await store()).tasks ?? []).find(x => x.title === title);
  await app.click(`.cal-day[data-iso="${iso.today}"]`); await wait(400);
  check('Day sheet', 'clicking a day opens its sheet (L5)', await app.evaluate(() => document.querySelector('#daySheet').open) && /\S/.test(await app.textContent('#sheetTitle')));
  await app.fill('#dailyTitle', 'Standup notes'); await app.selectOption('#dailyDays', 'every'); await app.press('#dailyTitle', 'Enter'); await wait(500);
  const su = await byTitle('Standup notes');
  check('Day sheet', 'add a daily recurring task, counted from today (L1)', su?.repeat?.days?.length === 7 && su.repeat.from === iso.today && await app.locator('#sheetDaily li', { hasText: 'Standup notes' }).count() === 1, JSON.stringify(su?.repeat));
  await app.locator('#sheetDaily li', { hasText: 'Standup notes' }).locator('input[type=checkbox]').check(); await wait(400);
  check('Day sheet', 'tick a daily task for this day (L5)', (await byTitle('Standup notes')).doneDates.includes(iso.today) && (await byTitle('Standup notes')).status === 'open');
  await app.fill('#extraTitle', 'Prepare demo'); await app.press('#extraTitle', 'Enter'); await wait(400);
  check('Day sheet', 'add an extra task for this day (L2)', (await byTitle('Prepare demo'))?.dueDate === iso.today && await app.locator('#sheetExtras li', { hasText: 'Prepare demo' }).count() === 1);
  const extra = () => app.locator('#sheetExtras li', { hasText: 'Prepare demo' });
  await extra().locator('summary').click(); await extra().locator('input.move').fill(iso.tomorrow); await wait(400);
  check('Day sheet', 'move an extra task to another day (L2)', (await byTitle('Prepare demo')).dueDate === iso.tomorrow && await extra().count() === 0);
  const ship = () => app.locator('#sheetExtras li', { hasText: 'Ship the login fix' });
  await ship().locator('summary').click(); await ship().locator('input.copy').fill(iso.dayAfter); await wait(400);
  const ships = ((await store()).tasks ?? []).filter(x => x.title === 'Ship the login fix');
  check('Day sheet', 'copy an extra task to another day, unticked (L2)', ships.length === 2 && ships.some(x => x.dueDate === iso.dayAfter && x.status === 'open') && ships.some(x => x.dueDate === iso.today && x.status === 'done'), JSON.stringify(ships.map(x => [x.dueDate, x.status])));
  await app.click('.toast button'); await wait(400);
  check('Day sheet', 'a copy is undoable', ((await store()).tasks ?? []).filter(x => x.title === 'Ship the login fix').length === 1);
  await app.fill('#dayNote', 'Offsite planning'); await app.press('#dayNote', 'Enter'); await wait(400);
  check('Day sheet', 'note slot: a note for this day (L3)', await app.locator('#sheetNotes li', { hasText: 'Offsite planning' }).count() === 1 && (await store()).notes.some(n => n.body === 'Offsite planning' && n.day === iso.today));
  check('Day sheet', 'progress shows the day’s share done', /^\d+ of \d+ done$/.test(await app.textContent('#sheetSub')), await app.textContent('#sheetSub'));
  await app.screenshot({ path: shots + '/6-day-sheet.png' });
  await app.keyboard.press('Escape'); await wait(300);
  check('Keys', 'Esc closes the day sheet (L9)', !(await app.evaluate(() => document.querySelector('#daySheet').open)));
  const bg = await app.locator(`.cal-day[data-iso="${iso.today}"]`).evaluate(el => `${el.className} ${el.style.getPropertyValue('--p')}`);
  check('Calendar', 'today is shaded once something is ticked (L4)', /\bheat\b/.test(bg) && Number(bg.split(' ').pop()) > 0, bg);

  await app.click(`.cal-day[data-iso="${iso.today}"]`); await wait(300);
  const daily = () => app.locator('#sheetDaily li', { hasText: 'Standup notes' });
  await daily().locator('summary').click(); await daily().locator('button.delete').click(); await wait(400);
  const stopped = await byTitle('Standup notes');
  check('Day sheet', 'Stop repeating ends it before this day, keeps its ticks', stopped.repeat.until === iso.yesterday && stopped.doneDates.includes(iso.today) && await daily().count() === 0);
  await app.click('.toast button'); await wait(400);
  check('Day sheet', 'Stop repeating is undoable', (await byTitle('Standup notes')).repeat.until === null && await daily().count() === 1);
  await app.keyboard.press('Escape');
  await app.goto(`${X}/${PAGES.app}#day=${iso.tomorrow}`); await wait(700);
  check('App', '#day=YYYY-MM-DD opens that day’s sheet', await app.evaluate(() => document.querySelector('#daySheet').open) && await extra().count() === 1);
  await app.keyboard.press('Escape'); await wait(200);
  await app.goto(`${X}/${PAGES.app}#day=${iso.yesterday}`); await wait(700);
  await app.fill('#dailyTitle', 'Past sheet daily'); await app.press('#dailyTitle', 'Enter'); await wait(500);
  const pastDaily = await byTitle('Past sheet daily');
  check('Day sheet', 'past-day daily add toasts that it starts today', (await app.textContent('.toast')) === 'Added. Daily tasks start today, so it shows from today on.' && pastDaily?.repeat?.from === iso.today, JSON.stringify(pastDaily?.repeat));
  await app.keyboard.press('Escape'); await wait(200);
  await app.screenshot({ path: shots + '/7-calendar.png' });
  await pan.reload(); await wait(600);
  check('Panel tasks', 'Today band lists daily tasks first (L1)', (await pan.locator('[data-band="today"] li .t-title').first().textContent()) === 'Standup notes');
}
