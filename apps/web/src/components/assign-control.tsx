'use client';

import type { AssignableUser } from '@app/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from './ui/button';

/**
 * Assignment is deliberately explicit - pick a person, press Assign - rather than a
 * select that fires on change. Reassigning work is a decision, not a stray click.
 */
export function AssignControl({
  orderId,
  users,
  currentAssigneeId,
}: {
  orderId: string;
  users: AssignableUser[];
  currentAssigneeId: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentAssigneeId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    if (!selected || selected === currentAssigneeId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assigneeId: selected }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? 'Could not assign this order.');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`assignee-${orderId}`}>
          Assign to
        </label>
        <select
          id={`assignee-${orderId}`}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink"
        >
          <option value="">Choose a person…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.roles.length ? ` · ${u.roles.join(', ')}` : ''}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={assign}
          disabled={busy || !selected || selected === currentAssigneeId}
        >
          {busy ? 'Saving' : currentAssigneeId ? 'Reassign' : 'Assign'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
