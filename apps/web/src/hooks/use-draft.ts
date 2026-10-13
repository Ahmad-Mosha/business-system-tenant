'use client';

import { useEffect, useEffectEvent, useState } from 'react';

const PREFIX = 'pm:draft:';
/** Unfinished work older than this is assumed abandoned. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

interface Stored<T> {
  savedAt: number;
  /** What the record looked like when editing started; a draft of an edit made before a newer change is not applied silently. */
  version?: string;
  value: T;
}

function read<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Stored<T>) : null;
  } catch {
    return null; // storage blocked or a corrupt entry: behave as if there is no draft
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

/** Signing out leaves nothing behind for the next person on this browser. */
export function clearAllDrafts() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {}
}

/**
 * Keeps an unfinished form in this browser as it is typed, so leaving the page,
 * refreshing or closing the tab never loses it. Coming back restores it; a
 * draft is only ever local work — nothing is sent until the form is submitted,
 * and `clear()` after a successful submit removes it.
 *
 * `key` must identify the user and the record (`<userId>:order:new`), so a
 * draft never appears on someone else's form. `version` is the record's last
 * update time for edit forms: a draft of an older version is offered, not
 * applied, because the record changed since.
 */
export function useDraft<T>({
  key,
  value,
  initial,
  apply,
  version,
}: {
  key: string;
  value: T;
  /** The untouched form; a value equal to it is not a draft. */
  initial: T;
  apply: (value: T) => void;
  version?: string;
}) {
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [stale, setStale] = useState<Stored<T> | null>(null);
  const [blank] = useState(() => JSON.stringify(initial));

  const restore = useEffectEvent(() => {
    const stored = read<T>(key);
    if (stored && Date.now() - stored.savedAt > MAX_AGE_MS) remove(key);
    else if (stored && stored.version !== version) setStale(stored);
    else if (stored) {
      apply(stored.value);
      setRestoredAt(stored.savedAt);
    }
    setReady(true);
  });
  // Browser storage exists only after hydration; reading it during render
  // would make the server and client disagree. React's documented two-pass
  // pattern for client-only values.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
  useEffect(() => restore(), [key]);

  const serialized = JSON.stringify(value);
  useEffect(() => {
    // Nothing is written until the stored draft has been read, or the empty
    // first render would overwrite it.
    if (!ready) return;
    if (serialized === blank) {
      // An untouched form keeps an older offered draft until the person decides.
      if (!stale) remove(key);
      return;
    }
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), version, value: JSON.parse(serialized) }));
    } catch {} // full or blocked storage: the form still works, it just isn't kept
  }, [ready, serialized, blank, key, version, stale]);

  return {
    /** When the restored draft was last saved, for the notice. */
    restoredAt,
    /** A draft made before the record last changed, offered while the form is untouched (typing replaces it). */
    staleAt: stale && serialized === blank ? stale.savedAt : null,
    restoreStale() {
      if (!stale) return;
      apply(stale.value);
      setRestoredAt(stale.savedAt);
      setStale(null);
    },
    /** Throws the draft away and puts the form back as it started; returns the draft for undo. */
    discard(): T | null {
      const previous = serialized !== blank ? (JSON.parse(serialized) as T) : (stale?.value ?? null);
      remove(key);
      setStale(null);
      setRestoredAt(null);
      apply(JSON.parse(blank) as T);
      return previous;
    },
    /** After a successful submit. */
    clear() {
      remove(key);
      setRestoredAt(null);
    },
  };
}
