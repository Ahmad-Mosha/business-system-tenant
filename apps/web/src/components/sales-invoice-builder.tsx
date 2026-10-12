'use client';

import { AlertTriangle, FileText, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveSalesDraft, updateSalesDraft, type SalesInvoicePayload } from '@/app/(app)/sales/actions';
import { Amount } from '@/components/amount';
import { CustomerForm } from '@/components/customer-form';
import { DatePicker, todayISO } from '@/components/date-picker';
import { DraftNotice } from '@/components/draft-notice';
import { NumberField } from '@/components/number-field';
import { Page, PageHeader } from '@/components/page';
import { VariantSearch } from '@/components/variant-search';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useDraft } from '@/hooks/use-draft';
import { b, num } from '@/i18n/rich';
import type { CustomerRow, SalesInvoiceDetail } from '@/lib/api';
import { money, unitMoney } from '@/lib/format';
import { lineTotalFor, priceLine, trimZeros } from '@/lib/purchase-line';
import { cn } from '@/lib/utils';

interface Line {
  key: string;
  variantId: string;
  label: string;
  /** As typed; a whole number of at least 1 before the invoice can be saved. */
  quantity: string;
  /** What was typed — `source` says which; the other is derived (lib/purchase-line). */
  unitPrice: string;
  lineTotal?: string;
  source?: 'unit' | 'total';
  /** Warehouse stock and inventory cost when the line was added — for warnings, not saved. */
  onHand: number | null;
  cost: string | null;
}

interface SalesForm {
  /** One id per invoice being written: a resend can never record it twice. */
  requestId: string;
  customerId: string;
  invoiceDate: string;
  notes: string;
  discount: string;
  lines: Line[];
}

const cellInput = 'h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-ring';

/**
 * Writing a sales invoice: the customer, what they take and at what price, and
 * what that leaves as profit at today's cost. Kept as a draft as it is typed;
 * nothing leaves stock until the invoice is posted.
 */
export function SalesInvoiceBuilder({
  customers,
  draftKey,
  invoice,
}: {
  customers: CustomerRow[];
  /** Identifies this user's unfinished invoice in the browser. */
  draftKey: string;
  /** A saved draft being edited; absent for a new invoice. */
  invoice?: SalesInvoiceDetail;
}) {
  const t = useTranslations('sales.builder');
  const tr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<CustomerRow[]>([]);
  const options = [...customers, ...added.filter((c) => !customers.some((x) => x.id === c.id))];

  const [form, setForm] = useState<SalesForm>(() => ({
    requestId: crypto.randomUUID(),
    customerId: invoice?.customerId ?? '',
    invoiceDate: invoice?.invoiceDate ?? todayISO(),
    notes: invoice?.notes ?? '',
    discount: invoice ? trimZeros(invoice.discount) : '',
    // Reopened on the unit price when it reproduces the saved total exactly,
    // otherwise on the total — a saved amount never moves.
    lines:
      invoice?.lines.map((l) => ({
        key: l.id,
        variantId: l.variantId,
        label: l.label,
        quantity: String(l.quantity),
        unitPrice: trimZeros(l.unitPrice),
        lineTotal: l.lineTotal,
        source: lineTotalFor(l.unitPrice, l.quantity) === l.lineTotal ? ('unit' as const) : ('total' as const),
        onHand: l.onHand,
        cost: l.currentCost,
      })) ?? [],
  }));
  const [initialForm] = useState(form);
  const draft = useDraft({ key: draftKey, value: form, initial: initialForm, apply: setForm, version: invoice?.updatedAt });
  const set = <K extends keyof SalesForm>(key: K) => (value: SalesForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setLines = (update: (lines: Line[]) => Line[]) => setForm((f) => ({ ...f, lines: update(f.lines) }));
  const patchLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const { lines } = form;
  const qty = (l: Line) => Number(l.quantity) || 0;
  const priced = new Map(lines.map((l) => [l.key, priceLine({ ...l, unitCost: l.unitPrice })]));
  const price = (l: Line) => {
    const p = priced.get(l.key)!;
    return { unitPrice: p.unitCost, lineTotal: p.lineTotal };
  };
  const subtotal = lines.reduce((s, l) => s + (Number(price(l).lineTotal) || 0), 0);
  const discount = Number(form.discount) || 0;
  const total = Math.max(subtotal - discount, 0);
  const units = lines.reduce((s, l) => s + qty(l), 0);
  const costKnown = lines.length > 0 && lines.every((l) => l.cost !== null);
  const cost = lines.reduce((s, l) => s + qty(l) * Number(l.cost ?? 0), 0);
  const profit = total - cost;
  const over = lines.filter((l) => l.onHand !== null && qty(l) > l.onHand);
  const below = lines.filter((l) => l.cost !== null && Number(price(l).unitPrice) > 0 && Number(price(l).unitPrice) < Number(l.cost));

  const missing = !form.customerId
    ? t('missing.customer')
    : !lines.length
      ? t('missing.product')
      : lines.some((l) => !Number.isInteger(qty(l)) || qty(l) < 1)
        ? t('missing.quantity')
        : lines.some((l) => !(Number(price(l).lineTotal) > 0))
          ? t('missing.price')
          : discount > subtotal + 0.005
            ? t('missing.discount')
            : null;

  const addLine = (hit: { id: string; label: string; onHand: number; sellingPrice: string | null; unitCost: string | null }) =>
    setLines((ls) =>
      ls.some((l) => l.variantId === hit.id)
        ? ls
        : [
            ...ls,
            {
              key: crypto.randomUUID(),
              variantId: hit.id,
              label: hit.label,
              quantity: '1',
              unitPrice: hit.sellingPrice ? trimZeros(hit.sellingPrice) : '',
              source: 'unit',
              onHand: hit.onHand,
              cost: hit.unitCost,
            },
          ],
    );

  const save = () => {
    const payload: SalesInvoicePayload = {
      requestId: form.requestId,
      customerId: form.customerId,
      invoiceDate: form.invoiceDate,
      discount: form.discount || '0',
      notes: form.notes.trim() || undefined,
      lines: lines.map((l) => ({
        variantId: l.variantId,
        quantity: qty(l),
        ...(l.source === 'total' ? { lineTotal: price(l).lineTotal } : { unitPrice: l.unitPrice }),
      })),
    };
    start(async () => {
      const res = invoice ? await updateSalesDraft(invoice.id, payload) : await saveSalesDraft(payload);
      if (!res.ok) return void toast.error(res.message);
      draft.clear();
      toast.success(t(invoice ? 'draftUpdated' : 'draftSaved'));
      router.push(`/sales/${res.id}`);
    });
  };

  return (
    <Page>
      <PageHeader
        back={{ href: invoice ? `/sales/${invoice.id}` : '/sales', label: tr('sales.detail.back') }}
        title={invoice ? t('editTitle') : t('title')}
        description={invoice ? t('editDescription') : t('description')}
      />
      <DraftNotice draft={draft} onUndo={setForm} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('customerAndDate')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
                <Field>
                  <FieldLabel htmlFor="si-customer">{t('customer')}</FieldLabel>
                  <div className="flex gap-2">
                    <Select value={form.customerId} onValueChange={set('customerId')} disabled={pending}>
                      <SelectTrigger id="si-customer" className="w-full min-w-0">
                        <SelectValue placeholder={t('choose')} />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {options.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <bdi>{c.name}</bdi>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <CustomerForm
                      compact
                      onCreated={(c) => {
                        setAdded((prev) => [...prev, c]);
                        set('customerId')(c.id);
                      }}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="si-date">{t('invoiceDate')}</FieldLabel>
                  <DatePicker id="si-date" value={form.invoiceDate} onChange={set('invoiceDate')} disabled={pending} />
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="si-notes">
                    {t('notes')} <span className="font-normal text-muted-foreground">{tr('common.optional')}</span>
                  </FieldLabel>
                  <Textarea
                    id="si-notes"
                    value={form.notes}
                    onChange={(e) => set('notes')(e.target.value)}
                    placeholder={t('notesPlaceholder')}
                    dir="auto"
                    rows={2}
                    disabled={pending}
                    className="min-h-14 resize-none"
                  />
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="pb-0">
            <CardHeader>
              <CardTitle>{t('products')}</CardTitle>
              <CardDescription>{t('productsHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              <VariantSearch
                disabled={pending}
                placeholder={t('searchPlaceholder')}
                disabledReason={(h) =>
                  lines.some((l) => l.variantId === h.id) ? tr('money.newInvoice.added') : h.onHand <= 0 ? tr('enums.stockState.out') : null
                }
                meta={(h) => [t('inStock', { count: h.onHand }), h.sellingPrice && money(h.sellingPrice)].filter(Boolean).join(' · ')}
                onPick={addLine}
              />
            </CardContent>
            <div className="mt-4 border-t">
              {lines.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr('sales.detail.columns.product')}</TableHead>
                      <TableHead className="w-[84px] text-end">{tr('sales.detail.columns.qty')}</TableHead>
                      <TableHead className="w-[118px] text-end">{tr('sales.detail.columns.unitPrice')}</TableHead>
                      <TableHead className="w-[124px] text-end">{tr('sales.detail.columns.lineTotal')}</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => {
                      const short = l.onHand !== null && qty(l) > l.onHand;
                      const cheap = below.includes(l);
                      return (
                        <TableRow key={l.key} className="hover:bg-transparent">
                          <TableCell className="min-w-40 py-2 whitespace-normal">
                            {/* Wraps rather than truncates: a product cut short on an invoice is the wrong product. */}
                            <p className="line-clamp-2 leading-snug font-medium" title={l.label}>
                              <bdi>{l.label}</bdi>
                            </p>
                            <p className="num mt-0.5 truncate text-xs text-muted-foreground">
                              {l.onHand !== null ? t('inStock', { count: l.onHand }) : null}
                              {l.cost !== null ? <span data-sensitive>{` · ${t('cost', { amount: unitMoney(l.cost) })}`}</span> : null}
                            </p>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <NumberField
                              value={l.quantity}
                              onValueChange={(v) => patchLine(l.key, { quantity: v })}
                              decimals={0}
                              min={1}
                              aria-label={tr('sales.detail.columns.qty')}
                              aria-invalid={short || qty(l) < 1}
                              disabled={pending}
                              className={cellInput}
                            />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <NumberField
                              value={price(l).unitPrice}
                              onValueChange={(v) => patchLine(l.key, { unitPrice: v, source: 'unit' })}
                              decimals={4}
                              group
                              placeholder="0.00"
                              aria-label={tr('sales.detail.columns.unitPrice')}
                              title={l.source === 'total' ? tr('money.newInvoice.calculated') : undefined}
                              disabled={pending}
                              className={cn(cellInput, l.source === 'total' && 'text-muted-foreground', cheap && 'border-warning')}
                            />
                          </TableCell>
                          <TableCell className="py-1.5">
                            <NumberField
                              value={price(l).lineTotal}
                              onValueChange={(v) => patchLine(l.key, { lineTotal: v, source: 'total' })}
                              group
                              placeholder="0.00"
                              aria-label={tr('sales.detail.columns.lineTotal')}
                              title={l.source !== 'total' ? tr('money.newInvoice.calculated') : undefined}
                              disabled={pending}
                              className={cn(cellInput, 'font-medium', l.source !== 'total' && 'text-muted-foreground')}
                            />
                          </TableCell>
                          <TableCell className="pe-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                              aria-label={tr('orders.form.remove', { name: l.label })}
                              disabled={pending}
                              className="text-muted-foreground hover:bg-destructive-subtle hover:text-destructive"
                            >
                              <Trash2 />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText />
                    </EmptyMedia>
                    <EmptyDescription>{t('noProducts')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-0">
          <Card>
            <CardHeader>
              <CardTitle>{t('summary')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">{t('subtotal', { items: tr('nouns.items', { count: units }) })}</span>
                <span className="num">{money(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="si-discount" className="text-muted-foreground">
                  {t('discount')}
                </label>
                <div className="w-36">
                  <NumberField
                    id="si-discount"
                    value={form.discount}
                    onValueChange={set('discount')}
                    group
                    placeholder="0.00"
                    aria-invalid={discount > subtotal + 0.005}
                    disabled={pending}
                    suffix={tr('common.egp')}
                  />
                </div>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t pt-3">
                <span className="font-medium">{t('total')}</span>
                <Amount value={total} className="text-[28px] font-semibold tracking-tight" />
              </div>

              {lines.length ? (
                <div className="rounded-lg bg-muted/50 px-3 py-2.5" data-sensitive-scope>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">{t('profit')}</span>
                    {costKnown ? (
                      <span className={cn('num font-semibold', profit < 0 ? 'text-destructive' : 'text-success')}>{money(profit)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {costKnown
                      ? t('profitHint', { margin: total > 0 ? `${((profit / total) * 100).toFixed(1)}%` : '—' })
                      : t('profitUnknown')}
                  </p>
                </div>
              ) : null}

              <Button size="lg" onClick={save} disabled={pending || !!missing} className="mt-1 w-full">
                {pending ? <Spinner /> : <Save />}
                {t('saveDraft')}
              </Button>
              {missing && !pending ? <p className="text-center text-xs text-muted-foreground">{missing}</p> : null}
              <p className="text-center text-xs text-muted-foreground">{t('postingSoon')}</p>
              <p className="text-center text-xs text-muted-foreground">{tr('drafts.autosaved')}</p>

              {over.map((l) => (
                <Alert key={`o${l.key}`} variant="destructive">
                  <AlertTriangle />
                  <AlertDescription>{t.rich('overStock', { name: l.label, count: l.onHand ?? 0, b, num })}</AlertDescription>
                </Alert>
              ))}
              {below.map((l) => (
                <Alert key={`b${l.key}`} variant="warning">
                  <AlertTriangle />
                  <AlertDescription data-sensitive>
                    {t.rich('belowCost', { name: l.label, cost: unitMoney(l.cost), b, num })}
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
