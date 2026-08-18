import { uuidv7 } from 'uuidv7';

/**
 * UUIDv7: time-ordered so primary-key inserts stay local in the index, and safe to
 * expose because it carries no sequence to enumerate.
 */
export function newId(): string {
  return uuidv7();
}
