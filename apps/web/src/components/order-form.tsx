'use client';

import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useActionState, useRef, useState } from 'react';
import { createOrder, updateOrder, type CreateOrderState } from '@/app/(app)/orders/actions';
import { Amount } from '@/components/amount';
import { Page, PageHeader } from '@/components/page';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
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
import { Textarea } from '@/components/ui/textarea';
import { VariantSearch, type VariantHit } from '@/components/variant-search';
import type { OrderDetail } from '@/lib/api';
import { money } from '@/lib/format';
import { GOVERNORATES } from '@/lib/governorates';
import { cn } from '@/lib/utils';
import { bdi, num } from '@/i18n/rich';

const INITIAL: CreateOrderState = { status: 'idle' };

/** Mirrors EGYPT_PHONE on the API — checked here too so the mod sees the
 * problem while typing, not after a round trip. */
const EGYPT_PHONE = /^(?:\+?20|0)?1[0125]\d{8}$/;
const isEgyptianPhone = (raw: string) =>
  EGYPT_PHONE.test(raw.replace(/[\s-]/g, '').replace(/^00/, '+'));

interface Line {
  key: string;
  variantId?: string;
  title: string;
  quantity: number;
  unitPrice: string;
  onHand?: number;
  unitCost?: string | null;
}

const PAYMENT_METHODS = [
  { value: 'COD', hint: 'codHint' },
  { value: 'WALLET', hint: 'prepaidHint' },
  { value: 'INSTAPAY', hint: 'prepaidHint' },
] as const;

/** An inline table input that reads as text until it's pointed at. */
const cellInput =
  'h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-ring';

/**
 * Manual order entry, and the edit screen for an existing one — the same form
 * either way, because they collect exactly the same thing. The summary rides
 * alongside the work (sticky), with the submit and anything blocking it.
 */
export function OrderForm({
  assignsToSelf,
  order,
}: {
  assignsToSelf?: boolean;
  order?: OrderDetail;
}) {
  const t = useTranslations('orders');
  const tc = useTranslations('common');
  const te = useTranslations('enums');
  const tn = useTranslations('nouns');
  const editing = !!order;
  const [state, submit, pending] = useActionState(
    editing ? updateOrder.bind(null, order.id) : createOrder,
    INITIAL,
  );
  const [lines, setLines] = useState<Line[]>(
    () =>
      order?.items.map((i, ix) => ({
        key: `e${ix}`,
        variantId: i.variantId ?? undefined,
        title: i.title,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })) ?? [],
  );
  const [shipping, setShipping] = useState(order?.shippingCost ?? '0');
  const [phone, setPhone] = useState(order?.customerPhone ?? '');
  const [governorate, setGovernorate] = useState(order?.governorate ?? '');
  const [method, setMethod] = useState<string>(order?.paymentMethod ?? 'COD');
  const seq = useRef(0);

  const addLine = (hit?: VariantHit) => {
    seq.current += 1;
    setLines((l) => [
      ...l,
      {
        key: `l${seq.current}`,
        variantId: hit?.id,
        title: hit?.label ?? '',
        quantity: 1,
        unitPrice: hit?.sellingPrice ?? '',
        onHand: hit?.onHand,
        unitCost: hit?.unitCost,
      },
    ]);
  };

  const patch = (key: string, next: Partial<Line>) =>
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...next } : x)));

  const lineTotal = (l: Line) => (Number(l.unitPrice) || 0) * l.quantity;
  const subtotal = lines.reduce((n, l) => n + lineTotal(l), 0);
  const total = subtotal + (Number(shipping) || 0);
  const units = lines.reduce((n, l) => n + l.quantity, 0);

  const phoneOk = isEgyptianPhone(phone);
  const phoneBad = phone.length > 0 && !phoneOk;
  const overStock = lines.filter((l) => l.onHand !== undefined && l.quantity > l.onHand);
  const belowCost = lines.filter(
    (l) => l.unitCost && Number(l.unitPrice) > 0 && Number(l.unitPrice) < Number(l.unitCost),
  );
  const unpriced = lines.filter((l) => !l.title.trim() || !(Number(l.unitPrice) > 0));
  // The first thing still missing, said under the disabled button — a button
  // that won't press without saying why is the worst kind of form.
  const missing = !lines.length
    ? t('form.needsItem')
    : unpriced.length
      ? t('form.needsNameAndPrice')
      : !phoneOk
        ? t('form.needsPhone')
        : !governorate
          ? t('form.needsGovernorate')
          : null;
  const ready = !missing && !overStock.length;
  const back = editing ? `/orders/${order.id}` : '/orders';
  // An order can carry a governorate outside the 27 (a website order's own
  // spelling). Offer it too — otherwise the form's native select falls back
  // to its first option and saving silently rewrites it to القاهرة.
  const governorates: readonly string[] =
    order?.governorate && !(GOVERNORATES as readonly string[]).includes(order.governorate)
      ? [order.governorate, ...GOVERNORATES]
      : GOVERNORATES;

  return (
    <form action={submit} className="contents">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines.map((l) => ({
            variantId: l.variantId,
            title: l.title,
            quantity: l.quantity,
            unitPrice: String(Number(l.unitPrice || 0).toFixed(2)),
          })),
        )}
      />

      <Page>
        <PageHeader
          back={{ href: back, label: editing ? t('form.backToOrder') : t('back') }}
          title={editing ? t('form.editTitle', { number: order.orderNumber }) : t('new')}
          description={
            editing
              ? t('form.editDescription')
              : assignsToSelf
                ? t('form.newDescriptionMine')
                : t('form.newDescriptionAdmin')
          }
          actions={
            <Button variant="outline" asChild>
              <Link href={back}>{tc('cancel')}</Link>
            </Button>
          }
        />

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 gap-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t('detail.customer')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="customerName">{t('form.fullName')}</FieldLabel>
                      <Input
                        id="customerName"
                        name="customerName"
                        dir="auto"
                        required
                        defaultValue={order?.customerName ?? ''}
                        placeholder={t('form.namePlaceholder')}
                        disabled={pending}
                      />
                    </Field>
                    <Field data-invalid={phoneBad}>
                      <FieldLabel htmlFor="customerPhone">{t('form.phone')}</FieldLabel>
                      <Input
                        id="customerPhone"
                        name="customerPhone"
                        required
                        inputMode="tel"
                        placeholder="01xxxxxxxxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        aria-invalid={phoneBad}
                        disabled={pending}
                        className="num"
                      />
                      {phoneBad ? <FieldError>{t('form.phoneInvalid')}</FieldError> : null}
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('detail.delivery')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <FieldGroup className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <Field>
                      <FieldLabel htmlFor="governorate">{t('detail.governorate')}</FieldLabel>
                      <Select
                        name="governorate"
                        value={governorate}
                        onValueChange={setGovernorate}
                        disabled={pending}
                      >
                        <SelectTrigger id="governorate" className="w-full">
                          <SelectValue placeholder={t('form.select')} />
                        </SelectTrigger>
                        <SelectContent position="popper" className="max-h-72">
                          {governorates.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="address">{t('form.address')}</FieldLabel>
                      <Input
                        id="address"
                        name="address"
                        dir="auto"
                        defaultValue={order?.address ?? ''}
                        placeholder={t('form.addressPlaceholder')}
                        disabled={pending}
                      />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>
            </div>

            <Card className="pb-0">
              <CardHeader>
                <CardTitle>{t('detail.items')}</CardTitle>
                <CardDescription>{t('form.itemsHint')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                  <VariantSearch
                    onPick={addLine}
                    disabled={pending}
                    disabledReason={(h) => (h.onHand <= 0 ? te('stockState.out') : null)}
                    meta={(h) =>
                      [t('form.inStock', { count: h.onHand }), h.sellingPrice && money(h.sellingPrice)]
                        .filter(Boolean)
                        .join(' · ')
                    }
                  />
                </div>
                <Button type="button" variant="outline" onClick={() => addLine()} disabled={pending}>
                  <Plus />
                  {t('form.customItem')}
                </Button>
              </CardContent>
              <div className="mt-4 border-t">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('columns.item')}</TableHead>
                      <TableHead className="w-[90px] text-end">{t('columns.qty')}</TableHead>
                      <TableHead className="w-[120px] text-end">{t('columns.unitPrice')}</TableHead>
                      <TableHead className="w-[110px] text-end">{t('columns.total')}</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          {t('form.noItems')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      lines.map((l) => {
                        const over = l.onHand !== undefined && l.quantity > l.onHand;
                        const under =
                          !!l.unitCost &&
                          Number(l.unitPrice) > 0 &&
                          Number(l.unitPrice) < Number(l.unitCost);
                        return (
                          <TableRow key={l.key} className="align-top">
                            <TableCell className="h-auto py-1.5 ps-2">
                              <Input
                                value={l.title}
                                onChange={(e) => patch(l.key, { title: e.target.value })}
                                placeholder={t('form.itemName')}
                                aria-label={t('form.itemName')}
                                dir="auto"
                                disabled={pending}
                                className={cn(cellInput, 'font-medium')}
                              />
                              <p className="px-2 text-xs text-muted-foreground">
                                {!l.variantId ? (
                                  <span className="text-warning">{t('form.notLinked')}</span>
                                ) : l.onHand === undefined ? (
                                  // Loaded from a saved order — linked, but
                                  // today's stock isn't known here.
                                  t('form.linked')
                                ) : (
                                  <span className="num">
                                    {[
                                      t('form.inStock', { count: l.onHand }),
                                      l.unitCost && t('form.cost', { amount: money(l.unitCost) }),
                                    ]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                )}
                              </p>
                            </TableCell>
                            <TableCell className="h-auto py-1.5">
                              <Input
                                type="number"
                                min={1}
                                value={l.quantity}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) =>
                                  patch(l.key, { quantity: Math.max(1, Number(e.target.value)) })
                                }
                                aria-label={t('form.quantity')}
                                aria-invalid={over}
                                disabled={pending}
                                className={cn(cellInput, 'num text-end', over && 'border-destructive')}
                              />
                            </TableCell>
                            <TableCell className="h-auto py-1.5">
                              <Input
                                inputMode="decimal"
                                value={l.unitPrice}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) => patch(l.key, { unitPrice: e.target.value })}
                                aria-label={t('columns.unitPrice')}
                                placeholder="0.00"
                                disabled={pending}
                                className={cn(cellInput, 'num text-end', under && 'border-warning')}
                              />
                            </TableCell>
                            <TableCell className="num h-auto py-1.5 text-end leading-8 font-medium">
                              {money(lineTotal(l))}
                            </TableCell>
                            <TableCell className="h-auto py-1.5 pe-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))}
                                aria-label={
                                  l.title ? t('form.remove', { name: l.title }) : t('form.removeItem')
                                }
                                disabled={pending}
                                className="text-muted-foreground hover:bg-destructive-subtle hover:text-destructive"
                              >
                                <Trash2 />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('form.paymentAndNotes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <RadioGroup
                    name="paymentMethod"
                    value={method}
                    onValueChange={setMethod}
                    disabled={pending}
                    aria-label={t('detail.paymentMethod')}
                    className="grid gap-2 sm:grid-cols-3"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <FieldLabel key={m.value} htmlFor={`pm-${m.value}`}>
                        <Field orientation="horizontal">
                          <RadioGroupItem value={m.value} id={`pm-${m.value}`} />
                          <FieldContent>
                            <FieldTitle className="font-medium">{te(`paymentMethod.${m.value}`)}</FieldTitle>
                            <FieldDescription>{t(`form.${m.hint}`)}</FieldDescription>
                          </FieldContent>
                        </Field>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                  <Field>
                    <FieldLabel htmlFor="notes">{t('detail.notes')}</FieldLabel>
                    <Textarea
                      id="notes"
                      name="notes"
                      dir="auto"
                      rows={2}
                      defaultValue={order?.notes ?? ''}
                      placeholder={t('form.notesPlaceholder')}
                      disabled={pending}
                      className="min-h-16 resize-none"
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-0">
            <Card>
              <CardHeader>
                <CardTitle>{t('detail.summary')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-[13px]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t('form.subtotal', { items: tn('items', { count: units }) })}
                  </span>
                  <span className="num">{money(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="shippingCost" className="text-muted-foreground">
                    {t('detail.shipping')}
                  </label>
                  <InputGroup className="w-32">
                    <InputGroupInput
                      id="shippingCost"
                      name="shippingCost"
                      inputMode="decimal"
                      value={shipping}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setShipping(e.target.value)}
                      disabled={pending}
                      className="num text-end"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{tc('egp')}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t pt-3">
                  <span className="font-medium">{t('detail.total')}</span>
                  <Amount value={total} className="text-[28px] font-semibold tracking-tight" />
                </div>

                {!editing ? (
                  <Field orientation="horizontal" className="mt-1">
                    <Checkbox id="paymentCollected" name="paymentCollected" disabled={pending} />
                    <FieldLabel htmlFor="paymentCollected" className="font-normal">
                      {t('form.paymentCollected')}
                    </FieldLabel>
                  </Field>
                ) : null}

                <Button type="submit" size="lg" disabled={!ready || pending} className="mt-1 w-full">
                  {pending ? <Spinner /> : <CheckCircle2 />}
                  {pending ? tc('saving') : editing ? tc('saveChanges') : t('form.create')}
                </Button>

                {missing && !pending ? (
                  <p className="text-center text-xs text-muted-foreground">{missing}</p>
                ) : null}

                {overStock.map((l) => (
                  <Alert key={`o${l.key}`} variant="destructive">
                    <AlertTriangle />
                    <AlertDescription>
                      {t.rich('form.overStock', { count: l.onHand ?? 0, name: l.title, bdi, num })}
                    </AlertDescription>
                  </Alert>
                ))}
                {belowCost.map((l) => (
                  <Alert key={`b${l.key}`} variant="warning">
                    <AlertTriangle />
                    <AlertDescription>
                      {t.rich('form.belowCost', { name: l.title, cost: money(l.unitCost), bdi, num })}
                    </AlertDescription>
                  </Alert>
                ))}
                {state.status === 'error' ? (
                  <Alert variant="destructive">
                    <AlertTriangle />
                    <AlertDescription>{state.message}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </div>
      </Page>
    </form>
  );
}
