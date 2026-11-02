// Task flows in the side panel's Today tab (D2, D3, D5, D6, D7, D10, L10).
import { unlabeled } from './panel.mjs';

const helpers = (t, pan) => ({
  byTitle: async title => ((await t.store()).tasks ?? []).find(x => x.title === title),
  row: title => pan.locator('#todayList li.row', { hasText: title }),
  toastUndo: () => pan.click('.toast button'),
  check2: (name, ok, detail) => t.check('Panel tasks', name, ok, detail),
});

export async function panelTaskChecks(t, pan) {
  const { wait, iso } = t;
  const { byTitle, row, toastUndo, check2 } = helpers(t, pan);
  await pan.reload(); await wait(500);
  check2('Today tab is the default', (await pan.getAttribute('#tab-today', 'aria-selected')) === 'true' && await pan.isVisible('#addTitle'));
  await pan.fill('#addTitle', 'Ship the login fix'); await pan.press('#addTitle', 'Enter'); await wait(400);
  const ship = await byTitle('Ship the login fix');
  check2('quick add with Enter: due today, default priority (D2)', ship?.dueDate === iso.today && ship.priority === 'medium' && await row('Ship the login fix').count() === 1, JSON.stringify(ship));
  await pan.fill('#addTitle', 'Call Acme Corp about renewal'); await pan.click('#panel-today form button'); await wait(400);
  check2('the Add button adds too', !!(await byTitle('Call Acme Corp about renewal')));
  await row('Ship the login fix').locator('input[type=checkbox]').check(); await wait(400);
  check2('tick closes a one-off; it stays in Today, struck through', (await byTitle('Ship the login fix')).status === 'done' && await row('Ship the login fix').evaluate(el => el.classList.contains('is-done')));
  await toastUndo(); await wait(400);
  check2('Undo in the toast reopens it (D6)', (await byTitle('Ship the login fix')).status === 'open');
  await row('Ship the login fix').locator('input[type=checkbox]').check(); await wait(400);
  await pan.keyboard.press('ControlOrMeta+z'); await wait(400);
  check2('⌘Z / Ctrl+Z undoes the last tick (D6)', (await byTitle('Ship the login fix')).status === 'open');
  await row('Ship the login fix').locator('input[type=checkbox]').check(); await wait(400);
  await row('Call Acme').locator('summary').click();
  await row('Call Acme').locator('select').selectOption('high'); await wait(400);
  check2('priority from the ⋯ menu', (await byTitle('Call Acme Corp about renewal')).priority === 'high');
  await row('Call Acme').locator('summary').click();
  await row('Call Acme').locator('input.move').fill(iso.yesterday); await wait(400);
  check2('due date from the ⋯ menu; a past day lands in Overdue', await pan.locator('[data-band="overdue"] li', { hasText: 'Call Acme' }).count() === 1);
  await pan.click('[data-band="overdue"] button.moveAll'); await wait(400);
  check2('Move all to tomorrow (D7)', (await byTitle('Call Acme Corp about renewal')).dueDate === iso.tomorrow && await pan.locator('[data-band="overdue"]').count() === 0);
  await toastUndo(); await wait(400);
  check2('Move all is undoable', (await byTitle('Call Acme Corp about renewal')).dueDate === iso.yesterday);
  await row('Call Acme').locator('summary').click(); await row('Call Acme').locator('button.tomorrow').click(); await wait(400);
  check2('Move to tomorrow, one task (D7)', (await byTitle('Call Acme Corp about renewal')).dueDate === iso.tomorrow && await row('Call Acme').count() === 0);
}

// The No date band and its saved state, delete + undo, N, and labels on a full panel.
export async function panelBandChecks(t, pan) {
  const { check, store, wait } = t;
  const { byTitle, row, toastUndo, check2 } = helpers(t, pan);
  await pan.fill('#addTitle', 'Read the Q4 plan'); await pan.press('#addTitle', 'Enter'); await wait(400);
  await row('Read the Q4 plan').locator('summary').click(); await row('Read the Q4 plan').locator('button', { hasText: 'Clear date' }).click(); await wait(400);
  const undated = pan.locator('details[data-band="undated"]');
  check2('No date band starts collapsed', await undated.count() === 1 && (await undated.getAttribute('open')) === null);
  await pan.click('details[data-band="undated"] > summary'); await wait(400);
  check2('band state is saved (uiState)', (await store()).uiState?.dayState?.undated === 'open', JSON.stringify((await store()).uiState));
  await pan.reload(); await wait(600);
  check2('band state survives a reload', (await pan.locator('details[data-band="undated"]').getAttribute('open')) !== null);
  const q4 = await byTitle('Read the Q4 plan');
  await row('Read the Q4 plan').locator('summary').click(); await row('Read the Q4 plan').locator('button.delete').click(); await wait(400);
  check2('delete from the ⋯ menu (D5)', !(await byTitle('Read the Q4 plan')));
  await toastUndo(); await wait(400);
  check2('Undo restores the deleted task, same id (D6)', (await byTitle('Read the Q4 plan'))?.id === q4.id);
  await pan.evaluate(() => document.activeElement?.blur());
  await pan.keyboard.press('n');
  check('Keys', 'N focuses the add box (panel)', await pan.evaluate(() => document.activeElement?.id === 'addTitle'));
  await row('Read the Q4 plan').locator('input[type=checkbox]').check(); await wait(400);
  await pan.fill('#addTitle', 'abc'); await pan.focus('#addTitle'); await pan.keyboard.press('ControlOrMeta+z'); await wait(400);
  check('Keys', '⌘Z / Ctrl+Z in a text field is left to the field', (await byTitle('Read the Q4 plan')).status === 'done');
  await row('Read the Q4 plan').locator('input[type=checkbox]').uncheck(); await wait(400);   // leave the fixture as found
  check('Keys', 'the tick is undone, fixture restored', (await byTitle('Read the Q4 plan')).status === 'open');
  await pan.fill('#addTitle', '');
  check('Layout', 'every control in a full panel has a label', (await unlabeled(pan)).length === 0, (await unlabeled(pan)).join(', '));
}

// Rollover (L10): a panel left open past midnight shows the new day on focus.
// Playwright's clock is per browser context, so this runs last: every page opened after it sees the fake time.
export async function rolloverCheck(t) {
  const { ctx, X, check, watch, wait, PAGES, iso } = t;
  const roll = watch(await ctx.newPage());
  await roll.clock.install({ time: new Date(`${iso.today}T23:59:30`) });
  await roll.goto(`${X}/${PAGES.panel}`); await wait(800);
  await roll.fill('#addTitle', 'Water the plants'); await roll.press('#addTitle', 'Enter'); await wait(400);
  const plants = () => roll.locator('#todayList li.row', { hasText: 'Water the plants' });
  await plants().locator('summary').click(); await plants().locator('input.move').fill(iso.tomorrow); await wait(400);
  const before = await plants().count();
  await roll.clock.fastForward(40000);
  await roll.evaluate(() => window.dispatchEvent(new Event('focus'))); await wait(600);
  check('Rollover', 'an open panel moves to the new day on focus (L10)', before === 0 && await roll.locator('[data-band="today"] li', { hasText: 'Water the plants' }).count() === 1);
  await roll.close();
}
