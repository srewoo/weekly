// The app's Tasks view: views, search, filter, edit, delete + undo, keys, links (D2–D6, D10).
import { unlabeled } from './panel.mjs';

export async function taskViewChecks(t, app) {
  const { check, store, wait, iso } = t;
  const byTitle = async title => ((await store()).tasks ?? []).find(x => x.title === title);
  const rows = async () => (await app.locator('#taskList li.row .t-title').allTextContents());
  const view = async id => { await app.click(`#taskViews [data-view="${id}"]`); await wait(250); };
  await app.click('#nav-tasks'); await wait(400);
  check('Tasks', 'Tasks view with Daybook’s views and counts (D3)', app.url().endsWith('#tasks') &&
    (await app.locator('#taskViews button').allTextContents()).map(s => s.replace(/\d+$/, '')).join(',') === 'Today,Week,Overdue,Upcoming,All open,Completed');
  await app.fill('#taskTitle', 'Book travel'); await app.press('#taskTitle', 'Enter'); await wait(400);
  check('Tasks', 'one-line add in the app (D2)', (await byTitle('Book travel'))?.dueDate === iso.today && (await rows()).includes('Book travel'));
  await app.fill('#q', 'acme'); await wait(250); await view('open');
  check('Tasks', 'search filters by title (D4)', (await rows()).join('|') === 'Call Acme Corp about renewal', (await rows()).join('|'));
  await app.press('#q', 'Escape'); await wait(200);
  check('Tasks', 'Esc clears the search', (await app.inputValue('#q')) === '' && (await rows()).length > 1);
  await app.selectOption('#pfilter', 'high'); await wait(250);
  check('Tasks', 'priority filter (D4)', (await rows()).join('|') === 'Call Acme Corp about renewal', (await rows()).join('|'));
  await app.selectOption('#pfilter', 'all'); await wait(200);
}

// Week bands, edit, delete + ⌘Z, Completed, keys, layout, the Settings link.
export async function taskEditChecks(t, app) {
  const { check, store, wait, iso } = t;
  const byTitle = async title => ((await store()).tasks ?? []).find(x => x.title === title);
  const rows = async () => (await app.locator('#taskList li.row .t-title').allTextContents());
  const view = async id => { await app.click(`#taskViews [data-view="${id}"]`); await wait(250); };
  await view('week');
  const tomorrowBand = app.locator(`details[data-band="${iso.tomorrow}"]`);
  check('Tasks', 'Week: a rolling 7 days of day bands, later days collapsed (D3)', await app.locator('#taskList details[data-band]').count() >= 7 && (await tomorrowBand.getAttribute('open')) === null);
  await tomorrowBand.locator(':scope > summary').click(); await wait(300);
  check('Tasks', 'opening a day band is remembered (uiState)', (await store()).uiState.dayState[iso.tomorrow] === 'open');
  await view('open');
  const acme = () => app.locator('#taskList li.row', { hasText: 'Call Acme' });
  await acme().locator('summary').click(); await acme().locator('button.edit').click(); await wait(200);
  await app.fill('#eTitle', 'Call Acme Corp about the renewal'); await app.fill('#eDesc', 'Bring the Q4 numbers');
  await app.selectOption('#ePriority', 'low'); await app.click('#eSave'); await wait(400);
  const edited = await byTitle('Call Acme Corp about the renewal');
  check('Tasks', 'edit title, description and priority (D5)', edited?.description === 'Bring the Q4 numbers' && edited.priority === 'low', JSON.stringify(edited));
  await acme().locator('summary').click(); await acme().locator('button.edit').click(); await wait(200);
  await app.fill('#eTitle', 'Call Acme Corp about renewal v2'); await app.press('#eTitle', 'Enter'); await wait(400);
  check('Tasks', 'Enter in the title saves the edit', (await byTitle('Call Acme Corp about renewal v2'))?.id === edited.id);
  await acme().locator('summary').click(); await acme().locator('button.edit').click(); await wait(200);
  await app.fill('#eTitle', 'Call Acme Corp about the renewal'); await app.click('#eSave'); await wait(400);
  await app.fill('#q', 'Q4 numbers'); await wait(250);
  check('Tasks', 'search covers descriptions (D4)', (await rows()).join('|') === 'Call Acme Corp about the renewal');
  await app.fill('#q', ''); await wait(200);
  await acme().locator('summary').click(); await acme().locator('button.delete').click(); await wait(400);
  check('Tasks', 'delete (D5)', !(await byTitle('Call Acme Corp about the renewal')));
  await app.evaluate(() => document.activeElement?.blur());
  await app.keyboard.press('ControlOrMeta+z'); await wait(400);
  check('Tasks', '⌘Z / Ctrl+Z undoes a delete (D6)', (await byTitle('Call Acme Corp about the renewal'))?.id === edited.id);
  await view('completed');
  check('Tasks', 'Completed view lists closed tasks', (await rows()).includes('Ship the login fix'));
  await app.evaluate(() => document.activeElement?.blur());
  await app.keyboard.press('/');
  check('Keys', '/ focuses search (app)', await app.evaluate(() => document.activeElement?.id === 'q'));
  await app.evaluate(() => document.activeElement?.blur());
  await app.click('#nav-calendar'); await app.keyboard.press('n');
  check('Keys', 'N goes to the add box from anywhere in the app', await app.evaluate(() => document.activeElement?.id === 'taskTitle') && app.url().endsWith('#tasks'));
  check('Layout', 'every app control has a label', (await unlabeled(app)).length === 0, (await unlabeled(app)).join(', '));
  await app.setViewportSize({ width: 400, height: 900 }); await wait(200);
  check('Layout', 'app: no sideways scrolling at phone width', await app.evaluate(() => document.documentElement.scrollWidth <= 400));
  await app.setViewportSize({ width: 1280, height: 900 });
  await app.click('#nav-settings'); await wait(900);
  check('App', 'Settings link opens the Settings page', app.url().includes('settings.html') && await app.isVisible('#role'));
  await app.close();
}
