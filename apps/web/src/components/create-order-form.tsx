'use client';

import {
  createOrderRequestSchema,
  type AssignableUser,
  type VariantListItem,
} from '@app/contracts';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardBody, CardHeader } from './ui/card';
import { Field } from './ui/field';
import { SearchIcon } from './icons';

interface Draft {
  variantId: string;
  sku: string;
  name: string;
  quantity: number;
  /** Major units while typing; converted to piastres on submit. */
  unitPrice: string;
}

const money = (minor: number) =>
  `${(minor / 100).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;

export function CreateOrderForm({
  variants,
  assignableUsers,
  canAssign,
}: {
  variants: VariantListItem[];
  assignableUsers: AssignableUser[];
  canAssign: boolean;
}) {
  const router = useRouter();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGovernorate, setCustomerGovernorate] = useState('');
  const [shipping, setShipping] = useState('55');
  const [discount, setDiscount] = useState('0');
  const [assigneeId, setAssigneeId] = useState('');

  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<Draft[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return variants
      .filter(
        (v) =>
          !lines.some((l) => l.variantId === v.id) &&
          (v.sku.toLowerCase().includes(term) || v.name.toLowerCase().includes(term)),
      )
      .slice(0, 6);
  }, [search, variants, lines]);

  const toMinor = (value: string) => Math.round((Number(value) || 0) * 100);
  const itemsTotal = lines.reduce((sum, l) => sum + toMinor(l.unitPrice) * l.quantity, 0);
  const total = itemsTotal + toMinor(shipping) - toMinor(discount);

  function addLine(v: VariantListItem) {
    setLines((prev) => [
      ...prev,
      { variantId: v.id, sku: v.sku, name: v.name, quantity: 1, unitPrice: '' },
    ]);
    setSearch('');
  }

  function updateLine(variantId: string, patch: Partial<Draft>) {
    setLines((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setErrors({});
    setFormError(null);

    const payload = {
      customerName,
      customerPhone,
      customerAddress: customerAddress || undefined,
      customerGovernorate: customerGovernorate || undefined,
      shippingTotal: toMinor(shipping),
      discountTotal: toMinor(discount),
      assigneeId: canAssign && assigneeId ? assigneeId : undefined,
      lines: lines.map((l) => ({
        variantId: l.variantId,
        quantity: l.quantity,
        unitPrice: toMinor(l.unitPrice),
      })),
    };

    // Validated with the same schema the API uses, so the messages match.
    const parsed = createOrderRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_';
        next[key] ??= issue.message;
      }
      setErrors(next);
      setFormError('Check the highlighted fields.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string; details?: Record<string, string[]> } }
          | null;
        if (body?.error?.details) {
          const next: Record<string, string> = {};
          for (const [k, v] of Object.entries(body.error.details)) if (v[0]) next[k] = v[0];
          setErrors(next);
        }
        setFormError(body?.error?.message ?? 'Could not create this order.');
        return;
      }
      const created = (await res.json()) as { id: string };
      router.push(`/orders/${created.id}`);
      router.refresh();
    } catch {
      setFormError('Could not reach the server.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Customer" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Full name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              error={errors.customerName}
              placeholder="e.g. Mona Adel"
            />
            <Field
              label="Phone number"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              error={errors.customerPhone}
              placeholder="01001234567"
              inputMode="tel"
            />
            <div className="sm:col-span-2">
              <Field
                label="Address"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                error={errors.customerAddress}
                placeholder="Street, building, apartment"
              />
            </div>
            <Field
              label="Governorate"
              value={customerGovernorate}
              onChange={(e) => setCustomerGovernorate(e.target.value)}
              error={errors.customerGovernorate}
              placeholder="Cairo"
            />
            {canAssign ? (
              <div className="space-y-1.5">
                <label htmlFor="assignee" className="block text-[13px] font-medium text-ink-2">
                  Assign to
                </label>
                <select
                  id="assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
                >
                  <option value="">Leave unassigned</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Products"
            action={
              <span className="text-[13px] text-ink-3">
                {lines.length} {lines.length === 1 ? 'line' : 'lines'}
              </span>
            }
          />
          <CardBody className="space-y-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">
                <SearchIcon className="size-[18px]" />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the catalog by SKU or name…"
                aria-label="Search products"
                className="h-10 w-full rounded-lg border border-line bg-surface pl-10 pr-3 text-sm text-ink placeholder:text-ink-3"
              />
              {matches.length > 0 ? (
                <ul className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg shadow-black/[0.06]">
                  {matches.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => addLine(v)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-line-soft"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] text-ink">{v.name}</span>
                          <span className="tnum block text-[12px] text-ink-3">{v.sku}</span>
                        </span>
                        <span className="shrink-0 text-[12px] font-medium text-ink-2">Add</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-[13.5px] text-ink-3">
                {errors.lines ? (
                  <span className="text-bad">{errors.lines}</span>
                ) : (
                  'Search above to add products to this order.'
                )}
              </p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {lines.map((line) => (
                  <li key={line.variantId} className="flex flex-wrap items-end gap-3 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-ink">{line.name}</span>
                      <span className="tnum block text-[12px] text-ink-3">{line.sku}</span>
                    </span>
                    <label className="w-20">
                      <span className="mb-1 block text-[11px] uppercase tracking-wide text-ink-3">
                        Qty
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.variantId, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="tnum h-9 w-full rounded-lg border border-line bg-surface px-2 text-right text-sm"
                      />
                    </label>
                    <label className="w-28">
                      <span className="mb-1 block text-[11px] uppercase tracking-wide text-ink-3">
                        Unit price
                      </span>
                      <input
                        inputMode="decimal"
                        value={line.unitPrice}
                        placeholder="0.00"
                        onChange={(e) => updateLine(line.variantId, { unitPrice: e.target.value })}
                        className="tnum h-9 w-full rounded-lg border border-line bg-surface px-2 text-right text-sm"
                      />
                    </label>
                    <span className="tnum w-28 pb-2 text-right text-[13.5px] font-medium text-ink">
                      {money(toMinor(line.unitPrice) * line.quantity)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      onClick={() =>
                        setLines((prev) => prev.filter((l) => l.variantId !== line.variantId))
                      }
                      className="pb-2 text-[13px] text-ink-3 hover:text-bad"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader title="Summary" />
          <CardBody className="space-y-3 text-sm">
            <Row label={`Items (${lines.length})`} value={money(itemsTotal)} />
            <label className="flex items-center justify-between gap-3 text-ink-2">
              <span>Shipping</span>
              <input
                inputMode="decimal"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                className="tnum h-8 w-24 rounded-lg border border-line bg-surface px-2 text-right"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-ink-2">
              <span>Discount</span>
              <input
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="tnum h-8 w-24 rounded-lg border border-line bg-surface px-2 text-right"
              />
            </label>
            <div className="flex items-center justify-between border-t border-line pt-3 text-[16px] font-semibold text-ink">
              <span>Total</span>
              <span className="tnum">{money(total)}</span>
            </div>

            {formError ? (
              <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-[13px] text-bad">
                {formError}
              </p>
            ) : null}

            <Button className="w-full" onClick={submit} disabled={submitting}>
              {submitting ? 'Creating…' : 'Create order'}
            </Button>
          </CardBody>
        </Card>

        <p className="px-1 text-[12px] leading-relaxed text-ink-3">
          Stock is not reserved yet — inventory arrives in a later slice. Until then this
          records the order and who is handling it.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-2">
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}
