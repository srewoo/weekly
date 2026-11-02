// The reminder engine: Daybook's decision matrix (each case would take a real day
// to check by hand), the one reused window, catch-up, and the DST-safe one-shot alarms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installChromeStub } from '../helpers/chrome-stub.js';

const ctx = installChromeStub();
const { fire, catchUp, rescheduleAll, clearOrphanAlarms, snooze, forgetWindowIfClosed, ALARM } = await import('../../src/background/reminders.js');
const { coerceTask } = await import('../../src/lib/schema.js');
const { toISODate, addDays } = await import('../../src/lib/dates.js');

const TODAY = toISODate();
const YESTERDAY = addDays(TODAY, -1);
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/** Fresh storage and logs. Every weekday is on, so the day of the week never decides a test by accident. */
async function seed(settings = {}, tasks = [], reminderState = {}) {
  for (const store of Object.values(ctx.stores)) for (const k of Object.keys(store)) delete store[k];
  for (const list of [ctx.log.windowsCreated, ctx.log.windowsUpdated, ctx.log.tabsUpdated, ctx.log.notifications, ctx.log.notificationsCleared]) list.length = 0;
  ctx.log.alarms.clear();
  await ctx.chrome.storage.local.set({
    settings: { days: EVERY_DAY, ...settings },
    tasks: tasks.map((t) => coerceTask({ title: 'a task', ...t })),
    schemaVersion: 2,
    reminderState: { morningLastShown: null, eveningLastShown: null, ...reminderState },
  });
}

test('a normal morning fires and opens exactly one popup window, with a notification', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  assert.equal(await fire('morning'), 'shown');
  assert.equal(ctx.log.windowsCreated.length, 1);
  assert.equal(ctx.log.windowsCreated[0].type, 'popup');
  assert.match(ctx.log.windowsCreated[0].url, /src\/ui\/remind\/remind\.html\?slot=morning$/);
  assert.equal(ctx.log.notifications.length, 1, 'system notification is on by default');
  assert.equal(ctx.log.notifications[0].id, 'weekly:remind:morning');
});

test('the morning brief is skipped when there is nothing to report, and marked shown', async () => {
  await seed({}, []);
  assert.equal(await fire('morning'), 'skipped-empty');
  assert.equal(ctx.log.windowsCreated.length, 0);
  const { reminderState } = await ctx.chrome.storage.local.get('reminderState');
  assert.equal(reminderState.morningLastShown, TODAY, 'marking it shown stops catch-up re-evaluating it all day');
});

test('the evening check always shows for someone who keeps tasks, including the all-clear', async () => {
  await seed({}, [{ status: 'done', completedAt: Date.now() - 86400e3 }]);
  assert.equal(await fire('evening'), 'shown');
  assert.match(ctx.log.windowsCreated[0].url, /slot=evening/);
});

test('a slot fires at most once per day', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  assert.equal(await fire('morning'), 'shown');
  assert.equal(await fire('morning'), 'skipped-shown');
  assert.equal(ctx.log.windowsCreated.length, 1, 'no second window');
});

test('a disabled slot does not fire', async () => {
  await seed({ morning: { enabled: false, time: '09:00' } }, [{ dueDate: TODAY }]);
  assert.equal(await fire('morning'), 'skipped-disabled');
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('a day that is not a working day does not fire', async () => {
  await seed({ days: [] }, [{ dueDate: TODAY }]);
  assert.equal(await fire('morning'), 'skipped-day');
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('force overrides every guard, so Preview and a snooze always show', async () => {
  await seed({ days: [], morning: { enabled: false, time: '09:00' } }, [], { morningLastShown: TODAY });
  assert.equal(await fire('morning', { force: true }), 'shown');
});

test('the system notification can be turned off independently of the window', async () => {
  await seed({ systemNotification: false }, [{ dueDate: TODAY }]);
  await fire('morning');
  assert.equal(ctx.log.windowsCreated.length, 1);
  assert.equal(ctx.log.notifications.length, 0);
});

test('a second reminder reuses the open window instead of stacking a new one', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  await fire('morning');
  await fire('evening');
  assert.equal(ctx.log.windowsCreated.length, 1, 'still one OS window');
  assert.equal(ctx.log.windowsUpdated.length, 1, 'the existing one is focused');
  assert.match(ctx.log.tabsUpdated.at(-1).url, /slot=evening/, 'and navigated to the new slot');
});

test('a window the user closed is forgotten, so the next reminder opens a new one', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  await fire('morning');
  await forgetWindowIfClosed(ctx.log.windowsCreated[0].id);
  await fire('evening');
  assert.equal(ctx.log.windowsCreated.length, 2);
});

test('closing the reminder window clears its notifications, so none waits in the notification centre (Phase 3 m2)', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  await fire('morning');
  await forgetWindowIfClosed(9999);
  assert.deepEqual(ctx.log.notificationsCleared, [], 'another window closing changes nothing');
  await forgetWindowIfClosed(ctx.log.windowsCreated[0].id);
  assert.deepEqual(ctx.log.notificationsCleared.sort(), ['weekly:remind:evening', 'weekly:remind:morning']);
});

test('catch-up delivers a slot whose time has passed today', async () => {
  await seed({ morning: { enabled: true, time: '09:00' }, evening: { enabled: false, time: '18:00' } }, [{ dueDate: TODAY }]);
  await catchUp(new Date(`${TODAY}T10:40:00`));
  assert.equal(ctx.log.windowsCreated.length, 1);
});

test('catch-up does not fire a slot that is still ahead', async () => {
  await seed({ morning: { enabled: true, time: '23:59' }, evening: { enabled: false, time: '18:00' } }, [{ dueDate: TODAY }]);
  await catchUp(new Date(`${TODAY}T10:40:00`));
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('catch-up cannot double-fire a slot already shown today', async () => {
  await seed({ evening: { enabled: false, time: '18:00' } }, [{ dueDate: TODAY }], { morningLastShown: TODAY });
  await catchUp(new Date(`${TODAY}T10:40:00`));
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('catch-up with both slots past leaves the evening check on screen', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  await catchUp(new Date(`${TODAY}T20:00:00`));
  assert.equal(ctx.log.windowsCreated.length, 1);
  assert.match(ctx.log.tabsUpdated.at(-1).url, /slot=evening/);
});

test('catch-up respects its own setting', async () => {
  await seed({ catchUpOnStartup: false }, [{ dueDate: TODAY }]);
  await catchUp(new Date(`${TODAY}T20:00:00`));
  assert.equal(ctx.log.windowsCreated.length, 0);
});

test('rescheduleAll creates one-shot alarms in the future, never a 24 h period', async () => {
  await seed({});
  await rescheduleAll();
  const morning = ctx.log.alarms.get(ALARM.morning);
  const evening = ctx.log.alarms.get(ALARM.evening);
  assert.ok(morning && evening);
  assert.ok(morning.when > Date.now(), 'an alarm in the past fires at once, in a loop');
  assert.equal(morning.periodInMinutes, undefined, 'a fixed period drifts across DST');
  assert.equal(new Date(morning.when).getHours(), 9);
  assert.equal(new Date(evening.when).getHours(), 18);
});

test('rescheduleAll leaves out a disabled slot and clears its old alarm', async () => {
  await seed({});
  await rescheduleAll();
  await ctx.chrome.storage.local.set({ settings: { days: EVERY_DAY, evening: { enabled: false, time: '18:00' } } });
  await rescheduleAll();
  assert.ok(!ctx.log.alarms.has(ALARM.evening), 'a stale alarm would keep firing after the toggle');
  assert.ok(ctx.log.alarms.has(ALARM.morning));
});

test('DST spring forward (8 Mar 2026 in New York): the next brief is still 09:00 local', async () => {
  await seed({});
  await rescheduleAll(new Date(2026, 2, 7, 9, 1));
  const at = new Date(ctx.log.alarms.get(ALARM.morning).when);
  assert.deepEqual([at.getDate(), at.getHours(), at.getMinutes()], [8, 9, 0]);
});

test('DST fall back (1 Nov 2026 in New York): the evening check is still 18:00 local', async () => {
  await seed({});
  await rescheduleAll(new Date(2026, 9, 31, 18, 1));
  const at = new Date(ctx.log.alarms.get(ALARM.evening).when);
  assert.deepEqual([at.getDate(), at.getHours(), at.getMinutes()], [1, 18, 0]);
});

test('a week of chained fires across the clock change stays on 09:00, where +24 h would drift', async () => {
  await seed({ evening: { enabled: false, time: '18:00' } });
  let from = new Date(2026, 2, 5, 9, 0, 30);
  const hours = [];
  let shifted = false;
  for (let i = 0; i < 6; i++) {
    await rescheduleAll(from);
    const when = ctx.log.alarms.get(ALARM.morning).when;
    hours.push(new Date(when).getHours());
    if (new Date(from.getTime() + 864e5).getHours() !== 9) shifted = true;   // where a fixed period would have landed
    from = new Date(when + 30_000);                                          // the alarm fires; the next is chained from then
  }
  assert.deepEqual(hours, [9, 9, 9, 9, 9, 9]);
  if (new Date(2026, 2, 7).getTimezoneOffset() !== new Date(2026, 2, 9).getTimezoneOffset()) {
    assert.ok(shifted, 'in a DST zone, +24 h from one fire would land at 10:00 after spring forward');
  }
});

test('orphans are cleared: Weekly 2’s Friday alarm goes, the tick, slots and a pending snooze stay', async () => {
  await seed({});
  await rescheduleAll();
  ctx.chrome.alarms.create('reminder', { when: Date.now() + 60_000 });
  ctx.chrome.alarms.create('tick', { periodInMinutes: 1 });
  await snooze(60);
  assert.deepEqual(await clearOrphanAlarms(), ['reminder']);
  for (const name of [ALARM.morning, ALARM.evening, ALARM.snooze, 'tick']) assert.ok(ctx.log.alarms.has(name), name);
  assert.deepEqual(await clearOrphanAlarms(), [], 'a no-op when there are none');
});

test('snooze brings the evening check back in an hour; the alarm is the only record', async () => {
  await seed({});
  const before = Date.now();
  await snooze(60);
  const when = ctx.log.alarms.get(ALARM.snooze).when;
  assert.ok(when >= before + 3_600_000 && when <= Date.now() + 3_600_000);
  const { reminderState } = await ctx.chrome.storage.local.get('reminderState');
  assert.deepEqual(reminderState, { morningLastShown: null, eveningLastShown: null }, 'nothing reads a snooze time, so none is stored');
});

test('the evening payload is what the window lists: yesterday’s open task is carried over', async () => {
  await seed({}, [{ id: 'late', dueDate: YESTERDAY }]);
  assert.equal(await fire('evening'), 'shown');
  assert.equal(ctx.log.notifications[0].title, 'One task still open');
});

test('a forced fire (Preview, snooze) does not mark the slot shown, so the real check still comes', async () => {
  await seed({}, [{ dueDate: TODAY }]);
  assert.equal(await fire('evening', { force: true }), 'shown');
  assert.equal(await fire('evening'), 'shown');
  assert.equal(await fire('evening'), 'skipped-shown');
});

test('rescheduleAll drops a pending snooze when the evening check is turned off', async () => {
  await seed({});
  await snooze(60);
  await ctx.chrome.storage.local.set({ settings: { days: EVERY_DAY, evening: { enabled: false, time: '18:00' } } });
  await rescheduleAll();
  assert.ok(!ctx.log.alarms.has(ALARM.snooze));
});

test('no tasks at all: no daily evening popup, except on the last working day (it links to the update)', async () => {
  // Today and tomorrow are working days, so today is the last one only when it is Sunday (weeks run Mon–Sun).
  const t = new Date().getDay();
  await seed({ days: [t, (t + 1) % 7] }, []);
  const lastDay = t === 0;
  assert.equal(await fire('evening'), lastDay ? 'shown' : 'skipped-no-tasks');
  await seed({ days: [t] }, []);
  assert.equal(await fire('evening'), 'shown', 'the last working day still comes');
});

test('notification-only reminders open no window; with notifications also off, the window still opens', async () => {
  await seed({ reminderWindow: false }, [{ dueDate: TODAY }]);
  assert.equal(await fire('morning'), 'shown');
  assert.equal(ctx.log.windowsCreated.length, 0);
  assert.equal(ctx.log.notifications.length, 1);
  await seed({ reminderWindow: false, systemNotification: false }, [{ dueDate: TODAY }]);
  await fire('morning');
  assert.equal(ctx.log.windowsCreated.length, 1, 'never neither');
});
