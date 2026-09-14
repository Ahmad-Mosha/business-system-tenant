'use client';

import { PackageOpen, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveInvoice, type InvoicePayload } from '@/app/(app)/money/actions';
import { AddProductDialog } from '@/components/add-product-dialog';
import { Amount } from '@/components/amount';
import { DatePicker, todayISO } from '@/components/date-picker';
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

interface Line {
  key: string;
  variantId: string;
  label: string;
  quantity: number;
  unitCost: string;
  onHand: number | null;
}

const cellInput =
  'h-8 border-transparent bg-transparent px-2 text-right shadow-none hover:border-input focus-visible:border-ring';

export function InvoiceBuilder({
  suppliers,
  cashBalance,
}: {
  suppliers: SupplierRow[];
  cashBalance: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [payment, setPayment] = useState<'CASH' | 'CREDIT'>('CREDIT');
  const [lines, setLines] = useState<Line[]>([]);
  const [creating, setCreating] = useState<string | null>(null);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const total = lines.reduce((s, l) => s + l.quantity * (Number(l.unitCost) || 0), 0);
  const missing = !supplierId
    ? 'Choose a supplier.'
    : !lines.length
      ? 'Add at least one product.'
      : lines.some((l) => !(Number(l.unitCost) > 0))
        ? 'Every line needs a unit cost.'
        : null;

  const patchLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = (variantId: string, label: string, onHand: number | null, unitCost = '') =>
    setLines((ls) =>
      ls.some((l) => l.variantId === variantId)
        ? ls
        : [...ls, { key: crypto.randomUUID(), variantId, label, quantity: 1, unitCost, onHand }],
    );

  const submit = (asDraft: boolean) => {
    const payload: InvoicePayload = {
      supplierId,
      invoiceNo: invoiceNo.trim() || undefined,
      invoiceDate,
      payment,
      // Shipping/customs allocation is off for now — every invoice is goods
      // only. The backend and its costing math still take these two fields;
      // turning it back on is re-adding the two inputs, nothing more.
      allocation: 'BY_VALUE',
      extraCosts: '0',
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost })),
    };
    start(async () => {
      const res = await saveInvoice(payload, asDraft);
      if (!res.ok) {
        toast.error(res.message);
        setConfirming(false);
        return;
      }
      toast.success(asDraft ? 'Draft saved.' : 'Invoice posted.');
      router.push(`/money/purchases/${res.id}`);
    });
  };

  const consequence =
    payment === 'CASH' ? (
      <>
        <span className="num font-medium text-foreground">{money(total)}</span> leaves the till — الخزينة
        goes <span className="num">{money(cashBalance)}</span> →{' '}
        <span className="num">{money(Number(cashBalance) - total)}</span>.
      </>
    ) : (
      <>
        <span className="num font-medium text-foreground">{money(total)}</span> is added to what you owe{' '}
        {supplier ? <bdi className="text-foreground">{supplier.name}</bdi> : 'the supplier'}. Record the
        payment from their page when you pay them.
      </>
    );

  return (
    <Page>
      <PageHeader
        back={{ href: '/money/purchases', label: 'Back to purchases' }}
        title="New purchase invoice"
        description="Stock in at cost — from one supplier, on one date."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Supplier and terms</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="inv-supplier">Supplier</FieldLabel>
                  <Select value={supplierId} onValueChange={setSupplierId} disabled={pending}>
                    <SelectTrigger id="inv-supplier" className="w-full">
                      <SelectValue placeholder="Choose…" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <bdi>{s.name}</bdi>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="inv-ref">
                    Invoice ref <span className="font-normal text-muted-foreground">(optional)</span>
                  </FieldLabel>
                  <Input
                    id="inv-ref"
                    value={invoiceNo}
                    onChange={(e) => setInvoiceNo(e.target.value)}
                    placeholder="The supplier’s number"
                    disabled={pending}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="inv-date">Invoice date</FieldLabel>
                  <DatePicker id="inv-date" value={invoiceDate} onChange={setInvoiceDate} disabled={pending} />
                </Field>
                <RadioGroup
                  value={payment}
                  onValueChange={(v) => setPayment(v as 'CASH' | 'CREDIT')}
                  disabled={pending}
                  aria-label="Payment"
                  className="grid gap-2 sm:col-span-3 sm:grid-cols-2"
                >
                  <FieldLabel htmlFor="pay-credit">
                    <Field orientation="horizontal">
                      <RadioGroupItem value="CREDIT" id="pay-credit" />
                      <FieldContent>
                        <FieldTitle className="font-medium">On credit</FieldTitle>
                        <FieldDescription>Pay the supplier later</FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                  <FieldLabel htmlFor="pay-cash">
                    <Field orientation="horizontal">
                      <RadioGroupItem value="CASH" id="pay-cash" />
                      <FieldContent>
                        <FieldTitle className="font-medium">Paid in cash now</FieldTitle>
                        <FieldDescription>Comes out of the till on posting</FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                </RadioGroup>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card className="pb-0">
            <CardHeader>
              <CardTitle>Products received</CardTitle>
              <CardDescription>Pick from inventory, or add a new product on the spot.</CardDescription>
            </CardHeader>
            <CardContent>
              <VariantSearch
                disabled={pending}
                placeholder="Add a product — search by Arabic name or SKU"
                disabledReason={(h) => (lines.some((l) => l.variantId === h.id) ? 'Added' : null)}
                meta={(h) => `${h.onHand} on hand`}
                onPick={(h) => addLine(h.id, h.label, h.onHand, h.unitCost ?? '')}
                onCreate={setCreating}
              />
            </CardContent>
            <div className="mt-4 border-t">
              {lines.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-[100px] text-end">Qty</TableHead>
                      <TableHead className="w-[130px] text-end">Unit cost</TableHead>
                      <TableHead className="w-[130px] text-end">Line total</TableHead>
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
                            <p className="num text-xs text-muted-foreground">{l.onHand} on hand now</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            type="number"
                            min={1}
                            value={l.quantity}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) =>
                              patchLine(l.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                            }
                            aria-label="Quantity"
                            disabled={pending}
                            className={`num ${cellInput}`}
                          />
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Input
                            inputMode="decimal"
                            value={l.unitCost}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => patchLine(l.key, { unitCost: e.target.value })}
                            placeholder="0.00"
                            aria-label="Unit cost"
                            aria-invalid={!(Number(l.unitCost) > 0)}
                            disabled={pending}
                            className={`num ${cellInput}`}
                          />
                        </TableCell>
                        <TableCell className="num text-end font-medium">
                          {money(l.quantity * (Number(l.unitCost) || 0))}
                        </TableCell>
                        <TableCell className="pe-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                            aria-label={`Remove ${l.label}`}
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
                    <EmptyDescription>No products yet — search above to add the first line.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-0">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">
                  <span className="num">{lines.length}</span> {lines.length === 1 ? 'product' : 'products'}
                </span>
                <Amount value={total} className="text-[28px] font-semibold tracking-tight" />
              </div>
              {lines.length ? (
                <p className="border-t pt-3 text-xs/relaxed text-muted-foreground">
                  On posting, {consequence} Either way,{' '}
                  <span className="num text-foreground">{money(total)}</span> of stock value is added.
                </p>
              ) : null}

              <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogTrigger asChild>
                  <Button size="lg" disabled={pending || !!missing} className="w-full">
                    <Send />
                    Post — <span className="num">{money(total)}</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Post this invoice?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {consequence} Stock comes in at these costs. Posting can’t be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending}>Not yet</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={pending}
                      onClick={(e) => {
                        e.preventDefault();
                        submit(false);
                      }}
                    >
                      {pending ? <Spinner /> : null}
                      Post invoice
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="outline"
                disabled={pending || !lines.length || !supplierId}
                onClick={() => submit(true)}
                className="w-full"
              >
                {pending && !confirming ? <Spinner /> : null}
                Save as draft
              </Button>
              {missing && !pending ? (
                <p className="text-center text-xs text-muted-foreground">{missing}</p>
              ) : null}
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
