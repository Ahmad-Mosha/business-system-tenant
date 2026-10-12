'use client';

import { PackageOpen, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveInvoice, type InvoicePayload } from '@/app/(app)/money/actions';
import { SupplierForm } from '@/components/supplier-form';
import { AddProductDialog } from '@/components/add-product-dialog';
import { Amount } from '@/components/amount';
import { DatePicker, todayISO } from '@/components/date-picker';
import { DraftNotice } from '@/components/draft-notice';
import { useDraft } from '@/hooks/use-draft';
import { Page, PageHeader } from '@/components/page';
import { VariantSearch } from '@/components/variant-search';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NumberField } from '@/components/number-field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { SupplierRow } from '@/lib/api';
import { money } from '@/lib/format';
import { b, num, strong } from '@/i18n/rich';

interface Line {
  key: string;
  variantId: string;
  label: string;
  /** As typed; a whole number of at least 1 before the invoice can be saved. */
  quantity: string;
  unitCost: string;
  onHand: number | null;
}

const cellInput =
  'h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-ring';

interface InvoiceForm {
  /** One id per invoice being entered: a resend can never record it twice. */
  requestId: string;
  supplierId: string;
  invoiceNo: string;
  invoiceDate: string;
  payment: 'CASH' | 'CREDIT';
  allocation: 'BY_VALUE' | 'PER_UNIT';
  extraCosts: string;
  separateCosts: boolean;
  lines: Line[];
}

export function InvoiceBuilder({
  suppliers,
  cashBalance,
  draftKey,
}: {
  suppliers: SupplierRow[];
  cashBalance: string;
  /** Identifies this user's unfinished invoice in the browser. */
  draftKey: string;
}) {
  const t = useTranslations('money');
  const tr = useTranslations();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const [newSuppliers, setNewSuppliers] = useState<SupplierRow[]>([]);
  const supplierOptions = [...suppliers, ...newSuppliers.filter((s) => !suppliers.some((existing) => existing.id === s.id))];
  // Everything typed lives in one object so it can be kept as a draft.
  const [form, setForm] = useState<InvoiceForm>(() => ({
    requestId: crypto.randomUUID(),
    supplierId: '',
    invoiceNo: '',
    invoiceDate: todayISO(),
    payment: 'CREDIT',
    allocation: 'BY_VALUE',
    extraCosts: '0',
    separateCosts: true,
    lines: [],
  }));
  const [initialForm] = useState(form);
  const draft = useDraft({ key: draftKey, value: form, initial: initialForm, apply: setForm });
  const { supplierId, invoiceNo, invoiceDate, payment, allocation, extraCosts, separateCosts, lines } = form;
  const set = <K extends keyof InvoiceForm>(key: K) => (value: InvoiceForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setSupplierId = set('supplierId');
  const setInvoiceNo = set('invoiceNo');
  const setInvoiceDate = set('invoiceDate');
  const setPayment = set('payment');
  const setAllocation = set('allocation');
  const setExtraCosts = set('extraCosts');
  const setSeparateCosts = set('separateCosts');
  const setLines = (update: (lines: Line[]) => Line[]) => setForm((f) => ({ ...f, lines: update(f.lines) }));
  const [creating, setCreating] = useState<string | null>(null);

  const supplier = supplierOptions.find((s) => s.id === supplierId);
  const qty = (l: Line) => Number(l.quantity) || 0;
  const goodsTotal = lines.reduce((s, l) => s + qty(l) * (Number(l.unitCost) || 0), 0);
  const extraValue = Number(extraCosts) || 0;
  const total = goodsTotal + extraValue;
  const totalUnits = lines.reduce((sum, l) => sum + qty(l), 0);
  const missing = !/^\d+(\.\d{1,2})?$/.test(extraCosts || '0')
    ? tr('validation.extraCosts')
    : lines.some((l) => !Number.isInteger(qty(l)) || qty(l) < 1)
      ? tr('validation.lineQuantity')
      : !supplierId
    ? tr('validation.chooseSupplier')
    : !lines.length
      ? tr('validation.addProduct')
      : lines.some((l) => !(Number(l.unitCost) > 0))
        ? tr('validation.lineCost')
        : null;

  const patchLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = (variantId: string, label: string, onHand: number | null, unitCost = '') =>
    setLines((ls) =>
      ls.some((l) => l.variantId === variantId)
        ? ls
        : [...ls, { key: crypto.randomUUID(), variantId, label, quantity: '1', unitCost, onHand }],
    );

  const submit = (asDraft: boolean) => {
    const payload: InvoicePayload = {
      requestId: form.requestId,
      supplierId,
      invoiceNo: invoiceNo.trim() || undefined,
      invoiceDate,
      payment,
      allocation,
      extraCosts: extraCosts || '0',
      extraCostsPaidSeparately: separateCosts,
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: qty(l), unitCost: l.unitCost })),
    };
    start(async () => {
      const res = await saveInvoice(payload, asDraft);
      if (!res.ok) {
        toast.error(res.message);
        setConfirming(false);
        return;
      }
      draft.clear();
      toast.success(t(asDraft ? 'newInvoice.draftSaved' : 'newInvoice.posted'));
      router.push(`/money/purchases/${res.id}`);
    });
  };

  const consequence = extraValue > 0 ? t('landed.paymentHint', { cash: money(payment === 'CASH' ? total : separateCosts ? extraValue : 0), supplier: money(payment === 'CREDIT' ? total - (separateCosts ? extraValue : 0) : 0) }) : t.rich('newInvoice.consequence', {
    payment,
    total: money(total),
    from: money(cashBalance),
    to: money(Number(cashBalance) - total),
    supplier: supplier?.name ?? t('newInvoice.theSupplier'),
    b,
    num,
    strong,
  });

  return (
    <Page>
      <PageHeader
        back={{ href: '/money/purchases', label: t('invoice.back') }}
        title={t('newInvoice.title')}
        description={t('newInvoice.description')}
      />

      <DraftNotice draft={draft} onUndo={setForm} />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('newInvoice.supplierAndTerms')}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="inv-supplier">{t('purchases.columns.supplier')}</FieldLabel>
                  <Select value={supplierId} onValueChange={setSupplierId} disabled={pending}>
                    <SelectTrigger id="inv-supplier" className="w-full">
                      <SelectValue placeholder={tr('common.choose')} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {supplierOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <bdi>{s.name}</bdi>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <SupplierForm onCreated={(s) => { setNewSuppliers((prev) => [...prev, { ...s, balance: '0.00' }]); setSupplierId(s.id); }} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="inv-ref">
                    {t('newInvoice.invoiceRef')}{' '}
                    <span className="font-normal text-muted-foreground">{tr('common.optional')}</span>
                  </FieldLabel>
                  <Input
                    id="inv-ref"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder={t('newInvoice.refPlaceholder')}
                    disabled={pending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="inv-date">{t('newInvoice.invoiceDate')}</FieldLabel>
                  <DatePicker id="inv-date" value={invoiceDate} onChange={setInvoiceDate} disabled={pending} />
                </Field>
                <RadioGroup
                  value={payment}
                  onValueChange={(v) => setPayment(v as 'CASH' | 'CREDIT')}
                  disabled={pending}
                  aria-label={t('purchases.columns.payment')}
                  className="grid gap-2 sm:col-span-3 sm:grid-cols-2"
                >
                  <FieldLabel htmlFor="pay-credit">
                    <Field orientation="horizontal">
                      <RadioGroupItem value="CREDIT" id="pay-credit" />
                      <FieldContent>
                        <FieldTitle className="font-medium">{t('newInvoice.onCredit')}</FieldTitle>
                        <FieldDescription>{t('newInvoice.onCreditHint')}</FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                  <FieldLabel htmlFor="pay-cash">
                    <Field orientation="horizontal">
                      <RadioGroupItem value="CASH" id="pay-cash" />
                      <FieldContent>
                        <FieldTitle className="font-medium">{t('newInvoice.cashNow')}</FieldTitle>
                        <FieldDescription>{t('newInvoice.cashNowHint')}</FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                </RadioGroup>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="pb-0">
            <CardHeader>
              <CardTitle>{t('newInvoice.productsReceived')}</CardTitle>
              <CardDescription>{t('newInvoice.productsHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              <VariantSearch
                disabled={pending}
                placeholder={t('newInvoice.searchPlaceholder')}
                disabledReason={(h) => (lines.some((l) => l.variantId === h.id) ? t('newInvoice.added') : null)}
                meta={(h) => t('newInvoice.onHand', { count: h.onHand })}
                onPick={(h) => addLine(h.id, h.label, h.onHand, h.unitCost ? Number(h.unitCost).toFixed(2) : '')}
                onCreate={setCreating}
              />
            </CardContent>
            <div className="mt-4 border-t">
              {lines.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('invoice.columns.product')}</TableHead>
                      <TableHead className="w-[100px] text-end">{t('invoice.columns.qty')}</TableHead>
                      <TableHead className="w-[130px] text-end">{t('invoice.columns.unitCost')}</TableHead>
                      <TableHead className="w-[130px] text-end">{t('invoice.columns.lineTotal')}</TableHead>
                      {extraValue > 0 ? <TableHead className="w-[130px] text-end">{t('landed.estimatedUnit')}</TableHead> : null}
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((l) => (
                      <TableRow key={l.key}>
                        <TableCell className="max-w-0">
                          <p className="truncate font-medium">
                            <bdi>{l.label}</bdi>
                          </p>
                          {l.onHand !== null ? (
                            <p className="num text-xs text-muted-foreground">
                              {t('newInvoice.onHandNow', { count: l.onHand })}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <NumberField
                            value={l.quantity}
                            onValueChange={(v) => patchLine(l.key, { quantity: v })}
                            decimals={0}
                            min={1}
                            aria-label={tr('product.stock.quantity')}
                            aria-invalid={qty(l) < 1}
                            disabled={pending}
                            className={cellInput}
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <NumberField
                            value={l.unitCost}
                            onValueChange={(v) => patchLine(l.key, { unitCost: v })}
                            group
                            placeholder="0.00"
                            aria-label={t('invoice.columns.unitCost')}
                            aria-invalid={!(Number(l.unitCost) > 0)}
                            disabled={pending}
                            className={cellInput}
                          />
                        </TableCell>
                        <TableCell className="num text-end font-medium">
                          {money(qty(l) * (Number(l.unitCost) || 0))}
                        </TableCell>
                        {extraValue > 0 ? <TableCell className="num text-end text-muted-foreground">{money(Number(l.unitCost || 0) + (allocation === 'BY_VALUE' ? (goodsTotal > 0 ? extraValue * Number(l.unitCost || 0) / goodsTotal : 0) : extraValue / totalUnits))}</TableCell> : null}
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
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <PackageOpen />
                    </EmptyMedia>
                    <EmptyDescription>{t('newInvoice.noProducts')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </Card>
          <Card><CardHeader><CardTitle>{t('landed.title')}</CardTitle><CardDescription>{t('landed.description')}</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="extra-costs">{t('landed.amount')}</FieldLabel><NumberField id="extra-costs" value={extraCosts} onValueChange={setExtraCosts} group disabled={pending} suffix={tr('common.egp')} /></Field>
              <Field><FieldLabel htmlFor="allocation">{t('landed.allocation')}</FieldLabel><Select value={allocation} onValueChange={(v) => setAllocation(v as typeof allocation)} disabled={pending}><SelectTrigger id="allocation"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BY_VALUE">{t('landed.byValue')}</SelectItem><SelectItem value="PER_UNIT">{t('landed.perUnit')}</SelectItem></SelectContent></Select></Field>
              <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={separateCosts} onChange={(e) => setSeparateCosts(e.target.checked)} disabled={pending} className="mt-1" />{t('landed.paidSeparately')}</label>
              {extraValue > 0 ? <p className="text-xs text-muted-foreground sm:col-span-2">{t('landed.paymentHint', { cash: money(payment === 'CASH' ? total : separateCosts ? extraValue : 0), supplier: money(payment === 'CREDIT' ? total - (separateCosts ? extraValue : 0) : 0) })}</p> : null}
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-0">
          <Card>
            <CardHeader>
              <CardTitle>{tr('orders.detail.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">{t('invoice.intoStock')}</span>
                <Amount value={total} className="text-[28px] font-semibold tracking-tight" />
              </div>
              {extraValue > 0 ? <p className="text-xs text-muted-foreground">{t('landed.breakdown', { goods: money(goodsTotal), extra: money(extraValue) })}</p> : null}
              {lines.length ? (
                <p className="border-t pt-3 text-xs/relaxed text-muted-foreground">
                  {t('newInvoice.onPosting')} {consequence}{' '}
                  {t.rich('newInvoice.eitherWay', { total: money(total), num })}
                </p>
              ) : null}

              <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogTrigger asChild>
                  <Button size="lg" disabled={pending || !!missing} className="w-full">
                    <Send />
                    {t.rich('newInvoice.postTotal', { total: money(total), num })}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('invoice.confirmTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {consequence} {t('newInvoice.cantUndo')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>{t('invoice.notYet')}</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={pending}
                      onClick={(e) => {
                        e.preventDefault();
                        submit(false);
                      }}
                    >
                      {pending ? <Spinner /> : null}
                      {t('invoice.post')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="outline"
                disabled={pending || !!missing}
                onClick={() => submit(true)}
                className="w-full"
              >
                {pending && !confirming ? <Spinner /> : null}
                {t('newInvoice.saveDraft')}
              </Button>
              {missing && !pending ? (
                <p className="text-center text-xs text-muted-foreground">{missing}</p>
              ) : null}
              <p className="text-center text-xs text-muted-foreground">{tr('drafts.autosaved')}</p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AddProductDialog
        open={creating !== null}
        onOpenChange={(o) => !o && setCreating(null)}
        initialName={creating ?? ''}
        onCreated={(variantId, label) => addLine(variantId, label, 0)}
      />
    </Page>
  );
}
