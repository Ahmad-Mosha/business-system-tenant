import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalNumber, caretAfterClean, cleanNumber, groupNumber, stepNumber } from './number-input';

const money = { decimals: 2 };
const whole = { decimals: 0 };

test('Arabic and Persian digits and the Arabic decimal mark read as Western', () => {
  assert.equal(cleanNumber('١٢٣٫٤٥', money), '123.45');
  assert.equal(cleanNumber('۴۵۰', whole), '450');
});

test('group separators and stray characters are dropped, not rejected', () => {
  assert.equal(cleanNumber('1,250,000', money), '1250000');
  assert.equal(cleanNumber('1٬250 EGP', money), '1250');
});

test('a second point or too many decimals is refused so the field keeps its value', () => {
  assert.equal(cleanNumber('12.5.', money), null);
  assert.equal(cleanNumber('12.345', money), null);
  assert.equal(cleanNumber('12.3456', { decimals: 4 }), '12.3456');
  assert.equal(cleanNumber('3.', whole), null);
});

test('a partial number stays as typed while editing', () => {
  assert.equal(cleanNumber('12.', money), '12.');
  assert.equal(cleanNumber('.5', money), '.5');
  assert.equal(cleanNumber('', money), '');
});

test('a minus sign is kept only where allowed and only in front', () => {
  assert.equal(cleanNumber('-12', money), '12');
  assert.equal(cleanNumber('-12', { ...money, negative: true }), '-12');
  assert.equal(cleanNumber('1-2', { ...money, negative: true }), '12');
});

test('the caret stays after the character it followed when others are dropped', () => {
  // "1,2|50" — a digit typed after "2" in a grouped value: two characters
  // before the caret survive cleaning ("12"), so the caret lands after them.
  assert.equal(caretAfterClean('1,29|50'.replace('|', ''), 4, money), 3);
  assert.equal(caretAfterClean('١٢٣', 2, whole), 2);
});

test('the canonical value has no dangling point, padding zeros or lone sign', () => {
  assert.equal(canonicalNumber('12.'), '12');
  assert.equal(canonicalNumber('007'), '7');
  assert.equal(canonicalNumber('0.50'), '0.50');
  assert.equal(canonicalNumber('.5'), '0.5');
  assert.equal(canonicalNumber('-'), '');
  assert.equal(canonicalNumber('-0'), '0');
  assert.equal(canonicalNumber('-05.5'), '-5.5');
  assert.equal(canonicalNumber(''), '');
});

test('grouping only touches the whole part', () => {
  assert.equal(groupNumber('1250000.5'), '1,250,000.5');
  assert.equal(groupNumber('-1250'), '-1,250');
  assert.equal(groupNumber('999'), '999');
});

test('arrow stepping never goes below the minimum', () => {
  assert.equal(stepNumber('1', -1, 1), '1');
  assert.equal(stepNumber('', 1, 1), '1');
  assert.equal(stepNumber('9', 1), '10');
});
