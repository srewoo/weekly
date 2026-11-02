// The Done section of the weekly update (spec §3.2, W2), on the report page.
export async function doneChecks(t, rep, pan) {
  const { sw, check, store, wait, workday, iso } = t;
  // The report covers Mon–Fri. Re-date today's ticks onto `workday` (today on a weekday, Friday at the weekend).
  const redate = () => sw.evaluate(async ({ wd, today }) => {
    const { tasks } = await chrome.storage.local.get('tasks');
    const noon = new Date(`${wd}T12:00:00`).getTime();
    for (const x of tasks) {
      if (x.completedAt && new Date(x.completedAt).toDateString() === new Date(`${today}T12:00:00`).toDateString()) x.completedAt = noon;
      if (x.repeat) { x.repeat.from = x.repeat.from > wd ? wd : x.repeat.from; x.doneDates = x.doneDates.map(d => (d === today ? wd : d)); }
    }
    await chrome.storage.local.set({ tasks });
  }, { wd: workday, today: iso.today });
  await redate(); await rep.bringToFront(); await rep.reload(); await wait(1500);
  const first = rep.locator('#categories .cat').first();
  check('Done', 'Done leads the activity list, tickable like other items', (await first.locator('h3').textContent()) === 'Done' && await first.locator('input[data-key^="task:"]').count() >= 2);
  let md = await rep.inputValue('#md');
  check('Done', 'draft opens with a Done section: one-offs, then recurring with its count (W2)', /^## Weekly update: .*\n\n### Done\n- Ship the login fix\n- Standup notes \(1 of 1 day\)\n/.test(md), md.slice(0, 200));
  const ship = ((await store()).tasks).find(x => x.title === 'Ship the login fix');
  await rep.uncheck(`input[data-key="task:${ship.id}"]`); await wait(400);
  md = await rep.inputValue('#md');
  check('Done', 'unticking a Done item drops it from this week’s draft', !md.includes('- Ship the login fix') && md.includes('Standup notes (1 of 1 day)'));
  check('Done', 'the untick is stored with the week’s exclusions', Object.entries(await store()).some(([k, v]) => k.startsWith('excluded:') && v.includes(`task:${ship.id}`)));
  await rep.check(`input[data-key="task:${ship.id}"]`); await wait(400);
  await rep.check('#anonymize'); await wait(400);
  check('Done', 'hide names leaves task titles as written; the hint says so', (await rep.inputValue('#md')).includes('- Ship the login fix') && /tasks and notes appear as you wrote them/.test(await rep.textContent('#anonHint')));
  await rep.uncheck('#anonymize'); await wait(300);
  // Another context (here the worker) reopens the task: the open report must follow without a reload.
  const setShip = done => sw.evaluate(async ({ id, done, wd }) => {
    const { tasks } = await chrome.storage.local.get('tasks');
    const x = tasks.find(y => y.id === id);
    x.status = done ? 'done' : 'open'; x.completedAt = done ? new Date(`${wd}T12:00:00`).getTime() : null;
    await chrome.storage.local.set({ tasks });
  }, { id: ship.id, done, wd: workday });
  await setShip(false); await wait(1200);
  // Reopened, it leaves Done (it may now be listed under Next week as still open).
  const doneSection = (await rep.inputValue('#md')).split('### Done')[1]?.split('###')[0] ?? '';
  check('Done', 'an open report follows task changes made elsewhere', !doneSection.includes('- Ship the login fix'));
  await setShip(true); await wait(1200);
  check('Done', 'and puts the task back when it is ticked again', (await rep.inputValue('#md')).includes('- Ship the login fix'));
  await pan.bringToFront(); await pan.click('#tab-week'); await wait(500);
  check('Done', 'side panel Week tab: tasks done this week, daily ticks counted per day', /^2 tasks done this week$/.test(await pan.textContent('#doneCount')), await pan.textContent('#doneCount'));
  await pan.click('#tab-today');
}
