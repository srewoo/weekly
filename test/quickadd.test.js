import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd, describeQuickAdd, repeatLabel } from '../src/lib/quickadd.js';

const MON = '2026-11-02';   // a Monday
const p = (/** @type {string} */ s, ref = MON) => parseQuickAdd(s, ref);

test('plain text is untouched', () => {
  assert.deepEqual(p('Call Sam'), { title: 'Call Sam' });
});

test('priority tokens, anywhere, case-insensitive', () => {
  assert.deepEqual(p('Fix login !high'), { title: 'Fix login', priority: 'high' });
  assert.deepEqual(p('!H fix login'), { title: 'fix login', priority: 'high' });
  assert.deepEqual(p('Fix !1 login'), { title: 'Fix login', priority: 'high' });
  assert.equal(p('x !med').priority, 'medium');
  assert.equal(p('x !2').priority, 'medium');
  assert.equal(p('x !LOW').priority, 'low');
  assert.equal(p('x !3').priority, 'low');
  assert.equal(p('x !l').priority, 'low');
  assert.deepEqual(p('Ship it!1'), { title: 'Ship it!1' });   // must follow a space
  assert.deepEqual(p('x !urgent'), { title: 'x !urgent' });
});

test('relative dates', () => {
  assert.deepEqual(p('Call Sam tomorrow'), { title: 'Call Sam', dueDate: '2026-11-03' });
  assert.equal(p('Call Sam TMRW').dueDate, '2026-11-03');
  assert.equal(p('Call Sam today').dueDate, MON);
  assert.deepEqual(p('tomorrow call Sam'), { title: 'call Sam', dueDate: '2026-11-03' });
  assert.equal(p('Call Sam in 3 days').dueDate, '2026-11-05');
  assert.equal(p('Call Sam in 1 day').dueDate, '2026-11-03');
  assert.equal(p('Call Sam due tomorrow').title, 'Call Sam');
});

test('next week is next Monday, from any day', () => {
  assert.equal(p('Plan next week').dueDate, '2026-11-09');          // from Mon
  assert.equal(p('Plan next week', '2026-11-04').dueDate, '2026-11-09');  // Wed
  assert.equal(p('Plan next week', '2026-11-08').dueDate, '2026-11-09');  // Sun
  assert.equal(p('Plan next week', '2026-11-07').dueDate, '2026-11-09');  // Sat
});

test('weekday at the end or after on/due/by means its next occurrence', () => {
  assert.deepEqual(p('Send report friday'), { title: 'Send report', dueDate: '2026-11-06' });
  assert.equal(p('Send report Fri').dueDate, '2026-11-06');
  assert.equal(p('Send report on Wednesday').dueDate, '2026-11-04');
  assert.equal(p('Send report by thurs').dueDate, '2026-11-05');
  assert.equal(p('Send report on friday deck').title, 'Send report deck');
});

test('today’s weekday means a week from now, not today', () => {
  assert.equal(p('Standup notes monday').dueDate, '2026-11-09');
  assert.equal(p('Standup notes sunday').dueDate, '2026-11-08');
  assert.equal(p('Standup notes monday', '2026-11-08').dueDate, '2026-11-09');   // Sun → tomorrow
});

test('false positives keep their title', () => {
  assert.deepEqual(p('Prepare Monday deck'), { title: 'Prepare Monday deck' });
  assert.deepEqual(p('Monday standup notes'), { title: 'Monday standup notes' });
  assert.deepEqual(p('Review today’s notes'), { title: 'Review today’s notes' });
  assert.deepEqual(p('Weekly sync prep'), { title: 'Weekly sync prep' });
  assert.deepEqual(p('Daily standup prep'), { title: 'Daily standup prep' });
  assert.deepEqual(p('Check in 3 days after launch'), { title: 'Check in 3 days after launch' });
  assert.deepEqual(p('Buy lemon'), { title: 'Buy lemon' });
  assert.deepEqual(p('Look at Sat Nav'), { title: 'Look at Sat Nav' });
});

test('a token with no title left is not parsed', () => {
  assert.deepEqual(p('Tomorrow'), { title: 'Tomorrow' });
  assert.deepEqual(p('!high'), { title: '!high' });
  assert.deepEqual(p('  every day  '), { title: 'every day' });
});

test('repeat: every day / weekdays / daily', () => {
  assert.deepEqual(p('Stretch every day'), { title: 'Stretch', repeatDays: [0, 1, 2, 3, 4, 5, 6] });
  assert.deepEqual(p('Stretch daily'), { title: 'Stretch', repeatDays: [0, 1, 2, 3, 4, 5, 6] });
  assert.deepEqual(p('Standup every weekday'), { title: 'Standup', repeatDays: [1, 2, 3, 4, 5] });
  assert.deepEqual(p('Standup weekdays'), { title: 'Standup', repeatDays: [1, 2, 3, 4, 5] });
});

test('repeat: every <days> in several spellings', () => {
  assert.deepEqual(p('Gym every mon,wed'), { title: 'Gym', repeatDays: [1, 3] });
  assert.deepEqual(p('Gym every Monday and Friday'), { title: 'Gym', repeatDays: [1, 5] });
  assert.deepEqual(p('Gym every wed, mon & sun please'), { title: 'Gym please', repeatDays: [0, 1, 3] });
  assert.deepEqual(p('Gym every tue thu'), { title: 'Gym', repeatDays: [2, 4] });
  assert.deepEqual(p('every friday review'), { title: 'review', repeatDays: [5] });
});

test('repeat: weekly means that weekday', () => {
  assert.deepEqual(p('Review weekly on friday'), { title: 'Review', repeatDays: [5] });
  assert.deepEqual(p('Review weekly tomorrow'), { title: 'Review', repeatDays: [2] });
  assert.deepEqual(p('Review weekly'), { title: 'Review', repeatDays: [1] });   // today is Monday
});

test('tokens combine; a repeat drops the due date', () => {
  assert.deepEqual(p('Call Sam tomorrow !high'), { title: 'Call Sam', priority: 'high', dueDate: '2026-11-03' });
  assert.deepEqual(p('Gym !low every mon,wed'), { title: 'Gym', priority: 'low', repeatDays: [1, 3] });
  assert.deepEqual(p('Standup friday daily'), { title: 'Standup', repeatDays: [0, 1, 2, 3, 4, 5, 6] });
  assert.deepEqual(p('Standup daily tomorrow'), { title: 'Standup', repeatDays: [0, 1, 2, 3, 4, 5, 6] });
});

test('month boundary', () => {
  assert.equal(p('x in 5 days', '2026-10-30').dueDate, '2026-11-04');
});

test('describeQuickAdd', () => {
  assert.equal(describeQuickAdd(p('Plain'), MON), '');
  assert.equal(describeQuickAdd(p('Call tomorrow !high'), MON), 'Tomorrow · High');
  assert.equal(describeQuickAdd(p('Gym every mon,wed'), MON), 'Repeats Mon, Wed · Medium');
  assert.equal(describeQuickAdd(p('Gym daily'), MON, 'low'), 'Repeats every day · Low');
  assert.equal(describeQuickAdd(p('Gym weekdays !h'), MON), 'Repeats weekdays · High');
  assert.equal(describeQuickAdd(p('x !low'), MON), 'Today · Low');
  assert.match(describeQuickAdd(p('x on friday'), MON), /Fri/);
});

test('repeatLabel', () => {
  assert.equal(repeatLabel([0, 1, 2, 3, 4, 5, 6]), 'every day');
  assert.equal(repeatLabel([1, 2, 3, 4, 5]), 'weekdays');
  assert.equal(repeatLabel([1, 3]), 'Mon, Wed');
});
