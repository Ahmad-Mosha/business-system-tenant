import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOCALES } from './config';
import { createFormat } from './format';

const en = createFormat(LOCALES.en, { today: 'Today', yesterday: 'Yesterday' });
const ar = createFormat(LOCALES.ar, { today: 'اليوم', yesterday: 'أمس' });

test('dates read in each language, in Cairo time, with Western digits', () => {
  assert.equal(en.date('2026-09-04'), '4 Sept 2026');
  assert.equal(ar.date('2026-09-04'), '4 سبتمبر 2026');
  // 12:29 UTC is 15:29 in Cairo (summer time).
  assert.equal(en.dateTime('2026-09-14T12:29:00.000Z'), '14 Sept, 15:29');
  assert.match(ar.dateTime('2026-09-14T12:29:00.000Z'), /^14 سبتمبر، 03:29/);
  assert.equal(ar.month('2026-07'), 'يوليو 2026');
  assert.equal(ar.count(12345), '12,345');
});

test('something dated without a time shows none', () => {
  assert.equal(en.time('2026-09-04T00:00:00.000Z'), '');
  assert.equal(en.dateTime('2026-09-04T00:00:00.000Z'), '4 Sept');
  assert.notEqual(ar.time('2026-09-14T12:29:00.000Z'), '');
});

test('rows group under their Cairo day, newest first', () => {
  // 22:30 UTC on the 13th is already the 14th in Cairo.
  const days = en.byDay([
    { occurredAt: '2026-09-13T22:30:00Z' },
    { occurredAt: '2026-09-14T09:00:00Z' },
    { occurredAt: '2026-09-13T10:00:00Z' },
  ]);
  assert.deepEqual(days.map((d) => [d.key, d.rows.length]), [['2026-09-14', 2], ['2026-09-13', 1]]);
});
