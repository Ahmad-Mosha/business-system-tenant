import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from './csv';

test('splits plain rows', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
});

test('keeps commas inside quoted fields — noon titles rely on this', () => {
  const rows = parseCsv('sku,title\nZ1,"Compressor, 150 PSI, Portable"\n');
  assert.deepEqual(rows[1], ['Z1', 'Compressor, 150 PSI, Portable']);
});

test('unescapes doubled quotes', () => {
  assert.deepEqual(parseCsv('a\n"say ""hi"""\n')[1], ['say "hi"']);
});

test('keeps newlines inside quoted fields', () => {
  assert.deepEqual(parseCsv('a,b\n"line1\nline2",x\n')[1], ['line1\nline2', 'x']);
});

test('preserves empty fields', () => {
  assert.deepEqual(parseCsv('a,b,c\n1,"",3\n')[1], ['1', '', '3']);
});

test('handles a final row without trailing newline', () => {
  assert.deepEqual(parseCsv('a,b\n1,2')[1], ['1', '2']);
});

test('strips a UTF-8 BOM', () => {
  assert.equal(parseCsv('﻿Contract,x\n')[0][0], 'Contract');
});
