import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isNowWithinAnnouncementWindow,
  isSameLocalDate,
  normalizeLocalDate,
  parseTimeRangeToDates,
  parseYMD,
} from '../../../src/modules/common/time/announcement-window.js';

test('normalizeLocalDate removes the time component', () => {
  const normalized = normalizeLocalDate(new Date(2025, 5, 3, 18, 42, 10));
  assert.equal(normalized.getFullYear(), 2025);
  assert.equal(normalized.getMonth(), 5);
  assert.equal(normalized.getDate(), 3);
  assert.equal(normalized.getHours(), 0);
});

test('isSameLocalDate compares local calendar dates', () => {
  assert.equal(isSameLocalDate(new Date(2025, 5, 3, 1), new Date(2025, 5, 3, 22)), true);
  assert.equal(isSameLocalDate(new Date(2025, 5, 3), new Date(2025, 5, 4)), false);
});

test('parseTimeRangeToDates finds the requested weekday from a fixed base date', () => {
  const base = new Date(2025, 5, 2, 9, 15); // Monday
  const result = parseTimeRangeToDates('Rabu', '10.30 - 12.00', base);

  assert.equal(result.start.getFullYear(), 2025);
  assert.equal(result.start.getMonth(), 5);
  assert.equal(result.start.getDate(), 4);
  assert.equal(result.start.getHours(), 10);
  assert.equal(result.start.getMinutes(), 30);
  assert.equal(result.end.getHours(), 12);
  assert.equal(result.targetDate.getHours(), 0);
});

test('isNowWithinAnnouncementWindow includes both endpoints', () => {
  const base = new Date(2025, 5, 2, 10, 0); // Monday
  assert.equal(isNowWithinAnnouncementWindow('Senin', '10.00-11.00', base), true);
  assert.equal(isNowWithinAnnouncementWindow('Senin', '10.00-11.00', new Date(2025, 5, 2, 11)), true);
  assert.equal(isNowWithinAnnouncementWindow('Senin', '10.00-11.00', new Date(2025, 5, 2, 11, 1)), false);
});

test('parseYMD accepts year, month and valid calendar-day precision', () => {
  assert.equal(parseYMD('2025')?.getFullYear(), 2025);
  assert.equal(parseYMD('2025-02')?.getDate(), 1);
  assert.equal(parseYMD(' 2024-02-29 ')?.getDate(), 29);
  assert.equal(parseYMD('not-a-date'), null);
});

test('parseYMD rejects calendar dates that do not exist', () => {
  assert.equal(parseYMD('2025-02-29'), null);
  assert.equal(parseYMD('2025-13-01'), null);
  assert.equal(parseYMD('2025-04-31'), null);
});
