import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import ar from '../messages/ar.json';
import en from '../messages/en.json';

type Tree = { [key: string]: string | Tree };

/** `{ nav: { items: { orders: '…' } } }` → `{ 'nav.items.orders': '…' }`. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** The placeholders a message expects, however deep its plural branches go. */
function argumentsOf(elements: MessageFormatElement[], found = new Set<string>()): Set<string> {
  for (const el of elements) {
    if (el.type === TYPE.literal || el.type === TYPE.pound) continue;
    found.add(el.value);
    if (el.type === TYPE.plural || el.type === TYPE.select) {
      for (const option of Object.values(el.options)) argumentsOf(option.value, found);
    }
    if (el.type === TYPE.tag) argumentsOf(el.children, found);
  }
  return found;
}

const english = flatten(en);
const arabic = flatten(ar);

test('Arabic has every English message, and nothing English lacks', () => {
  assert.deepEqual([...english.keys()].filter((k) => !arabic.has(k)), [], 'missing in ar.json');
  assert.deepEqual([...arabic.keys()].filter((k) => !english.has(k)), [], 'only in ar.json');
});

test('each Arabic message takes the same placeholders as its English one', () => {
  for (const [key, message] of english) {
    const expected = [...argumentsOf(parse(message))].sort();
    const actual = [...argumentsOf(parse(arabic.get(key) ?? ''))].sort();
    assert.deepEqual(actual, expected, key);
  }
});
