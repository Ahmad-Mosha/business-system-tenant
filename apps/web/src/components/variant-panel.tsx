'use client';

import { ArrowDownLeft, ArrowUpRight, History, Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { recordStock, updateVariant } from '@/app/(app)/inventory/actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { cn, isOneOf } from '@/lib/utils';
import { num } from '@/i18n/rich';
import { useFormat } from '@/i18n/use-format';

/** The reasons a person records by hand — SALE is recorded by orders. Names: `enums.stockReason`. */
const REASONS = ['PURCHASE', 'RETURN', 'DAMAGE', 'COUNT', 'ADJUSTMENT'] as const;
const ALL_REASONS = [...REASONS, 'SALE'] as const;

interface Variant {
  id: string;
  name: string;
  sku: string | null;
  unitCost: string | null;
  sellingPrice: string | null;
  onHand: number;
  inOpenOrders: number;
}

export interface Movement {
  id: string;
  quantity: number;
  reason: string;
  note: string | null;
  occurredAt: string;
  runningTotal: number;
}

/**
 * One variant's stock: the figure, its cost and price, a way to record a
 * movement, and every movement that produced the figure — no number without a
 * way into the events behind it. `single` means the page's figures already
 * are this variant's, so the card doesn't repeat them.
 */
export function VariantPanel({
  variant,
  movements,
  single = false,
}: {
  variant: Variant;
  movements: Movement[];
  single?: boolean;
}) {
  const t = useTranslations('product.stock');
  const tr = useTranslations();
  const f = useFormat();
  const [pending, start] = useTransition();
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState<string>('PURCHASE');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [cost, setCost] = useState(variant.unitCost ?? '');
  const [price, setPrice] = useState(variant.sellingPrice ?? '');

  const pricesDirty = cost !== (variant.unitCost ?? '') || price !== (variant.sellingPrice ?? '');
  // The API refuses a removal below zero too; this just says so before asking.
  const count = Number(qty) || 0;
  const available = Math.max(variant.onHand, 0);
  const tooMany = direction === 'out' && count > available;

  const save = () =>
    start(async () => {
      const r = await updateVariant(variant.id, { unitCost: cost || null, sellingPrice: price || null });
      if (r.ok) toast.success(t('saved'));
      else toast.error(r.message);
    });

  const move = () =>
    start(async () => {
      const n = Number(qty) * (direction === 'in' ? 1 : -1);
      const r = await recordStock(variant.id, n, reason);
      if (r.ok) {
        toast.success(t(n > 0 ? 'increased' : 'reduced', { count: Math.abs(n) }));
        setQty('1');
      } else toast.error(r.message);
    });

  return (
    <Card className="pb-0">
      {single ? (
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
      ) : (
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <bdi>{variant.name}</bdi>
            {variant.sku ? (
              <Badge variant="secondary" className="font-mono">
                {variant.sku}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            {variant.inOpenOrders > 0
              ? t.rich('inOpenOrders', { count: variant.inOpenOrders, num })
              : t('noneWaiting')}
          </CardDescription>
          <CardAction className="text-end">
            <p
              className={cn(
                'num text-xl leading-none font-semibold tracking-tight',
                variant.onHand <= 0 && 'text-destructive',
              )}
            >
              {variant.onHand}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('onHand')}</p>
          </CardAction>
        </CardHeader>
      )}

      <CardContent className="grid gap-5 md:grid-cols-2">
        <FieldGroup className="gap-3">
          <p className="text-xs font-medium">{t('pricing')}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor={`cost-${variant.id}`}>{tr('product.unitCost')}</FieldLabel>
              <MoneyField id={`cost-${variant.id}`} value={cost} onChange={setCost} disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`price-${variant.id}`}>{t('sellingPrice')}</FieldLabel>
              <MoneyField id={`price-${variant.id}`} value={price} onChange={setPrice} disabled={pending} />
            </Field>
          </div>
          <Button variant="outline" onClick={save} disabled={pending || !pricesDirty} className="w-fit">
            {pending ? <Spinner /> : null}
            {t('savePrices')}
          </Button>
        </FieldGroup>

        <FieldGroup className="gap-3">
          <p className="text-xs font-medium">{t('record')}</p>
          <div className="grid grid-cols-[auto_80px_minmax(0,1fr)] items-end gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={direction}
              onValueChange={(v) => v && setDirection(v as 'in' | 'out')}
              aria-label={t('direction')}
            >
              <ToggleGroupItem value="in" aria-label={t('in')}>
                <Plus />
              </ToggleGroupItem>
              <ToggleGroupItem value="out" aria-label={t('out')}>
                <Minus />
              </ToggleGroupItem>
            </ToggleGroup>
            <Field>
              <FieldLabel htmlFor={`qty-${variant.id}`}>{t('quantity')}</FieldLabel>
              <Input
                id={`qty-${variant.id}`}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                inputMode="numeric"
                disabled={pending}
                className="num"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`reason-${variant.id}`}>{t('reason')}</FieldLabel>
              <Select value={reason} onValueChange={setReason} disabled={pending}>
                <SelectTrigger id={`reason-${variant.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {tr(`enums.stockReason.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={move} disabled={pending || !count || tooMany} className="w-fit">
              {pending ? <Spinner /> : direction === 'in' ? <Plus /> : <Minus />}
              {t(direction === 'in' ? 'add' : 'remove', { units: tr('nouns.units', { count }) })}
            </Button>
            {tooMany ? (
              <p role="status" className="text-xs text-destructive">
                {available > 0 ? t.rich('onlyOnHand', { count: available, num }) : t('nothingToRemove')}
              </p>
            ) : null}
          </div>
        </FieldGroup>
      </CardContent>

      <div className="mt-5 border-t">
        {movements.length ? (
          <div className="max-h-96 overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_[data-slot=table-container]]:overflow-visible">
            {/* Read like the ledger: which way it went, why, then the count after it. */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('movement')}</TableHead>
                  <TableHead className="w-[90px] text-end">{t('change')}</TableHead>
                  <TableHead className="w-[90px] text-end">{t('balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => {
                  const inbound = m.quantity > 0;
                  const Icon = inbound ? ArrowDownLeft : ArrowUpRight;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="h-12 max-w-0">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            title={tr(inbound ? 'ledger.in' : 'ledger.out')}
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center',
                              inbound ? 'bg-success-subtle text-success' : 'bg-destructive-subtle text-destructive',
                            )}
                          >
                            <Icon className="size-3.5 rtl:-scale-x-100" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {isOneOf(ALL_REASONS, m.reason) ? tr(`enums.stockReason.${m.reason}`) : m.reason}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {f.dateTime(m.occurredAt)}
                              {m.note ? (
                                <>
                                  {' · '}
                                  <bdi>{m.note}</bdi>
                                </>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn('num text-end font-semibold', inbound ? 'text-success' : 'text-destructive')}
                      >
                        <bdi>{`${inbound ? '+' : '−'}${Math.abs(m.quantity)}`}</bdi>
                      </TableCell>
                      <TableCell className="num text-end text-muted-foreground">{m.runningTotal}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyDescription>{t('noMovements')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </Card>
  );
}

function MoneyField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        inputMode="decimal"
        placeholder={t('notSet')}
        disabled={disabled}
        className="num"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{t('egp')}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}
