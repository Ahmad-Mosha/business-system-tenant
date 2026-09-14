'use client';

import { History, Minus, Plus } from 'lucide-react';
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
import { dateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const REASONS = [
  { value: 'PURCHASE', label: 'Purchased' },
  { value: 'RETURN', label: 'Returned by customer' },
  { value: 'DAMAGE', label: 'Damaged or lost' },
  { value: 'COUNT', label: 'Physical count' },
  { value: 'ADJUSTMENT', label: 'Correction' },
] as const;

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
 * way into the events behind it.
 */
export function VariantPanel({ variant, movements }: { variant: Variant; movements: Movement[] }) {
  const [pending, start] = useTransition();
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState<string>('PURCHASE');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [cost, setCost] = useState(variant.unitCost ?? '');
  const [price, setPrice] = useState(variant.sellingPrice ?? '');

  const pricesDirty = cost !== (variant.unitCost ?? '') || price !== (variant.sellingPrice ?? '');

  const save = () =>
    start(async () => {
      const r = await updateVariant(variant.id, { unitCost: cost || null, sellingPrice: price || null });
      if (r.ok) toast.success('Saved.');
      else toast.error(r.message);
    });

  const move = () =>
    start(async () => {
      const n = Number(qty) * (direction === 'in' ? 1 : -1);
      const r = await recordStock(variant.id, n, reason);
      if (r.ok) {
        toast.success(`Stock ${n > 0 ? 'increased' : 'reduced'} by ${Math.abs(n)}.`);
        setQty('1');
      } else toast.error(r.message);
    });

  return (
    <Card className="pb-0">
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
          {variant.inOpenOrders > 0 ? (
            <>
              <span className="num">{variant.inOpenOrders}</span> in open orders — already off the
              shelf count
            </>
          ) : (
            'Nothing waiting in open orders'
          )}
        </CardDescription>
        <CardAction className="text-right">
          <p
            className={cn(
              'num text-[28px] leading-none font-semibold tracking-tight',
              variant.onHand <= 0 && 'text-destructive',
            )}
          >
            {variant.onHand}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">on hand</p>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-5 md:grid-cols-2">
        <FieldGroup className="gap-3">
          <p className="text-xs font-medium">Pricing</p>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor={`cost-${variant.id}`}>Unit cost</FieldLabel>
              <MoneyField id={`cost-${variant.id}`} value={cost} onChange={setCost} disabled={pending} />
            </Field>
            <Field>
              <FieldLabel htmlFor={`price-${variant.id}`}>Selling price</FieldLabel>
              <MoneyField id={`price-${variant.id}`} value={price} onChange={setPrice} disabled={pending} />
            </Field>
          </div>
          <Button variant="outline" onClick={save} disabled={pending || !pricesDirty} className="w-fit">
            {pending ? <Spinner /> : null}
            Save prices
          </Button>
        </FieldGroup>

        <FieldGroup className="gap-3">
          <p className="text-xs font-medium">Record a movement</p>
          <div className="grid grid-cols-[auto_80px_minmax(0,1fr)] items-end gap-2">
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={0}
              value={direction}
              onValueChange={(v) => v && setDirection(v as 'in' | 'out')}
              aria-label="Direction"
            >
              <ToggleGroupItem value="in" aria-label="Stock in" className="data-[state=on]:bg-foreground data-[state=on]:text-background">
                <Plus />
              </ToggleGroupItem>
              <ToggleGroupItem value="out" aria-label="Stock out" className="data-[state=on]:bg-foreground data-[state=on]:text-background">
                <Minus />
              </ToggleGroupItem>
            </ToggleGroup>
            <Field>
              <FieldLabel htmlFor={`qty-${variant.id}`}>Quantity</FieldLabel>
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
              <FieldLabel htmlFor={`reason-${variant.id}`}>Reason</FieldLabel>
              <Select value={reason} onValueChange={setReason} disabled={pending}>
                <SelectTrigger id={`reason-${variant.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button onClick={move} disabled={pending || !Number(qty)} className="w-fit">
            {pending ? <Spinner /> : direction === 'in' ? <Plus /> : <Minus />}
            {direction === 'in' ? 'Add' : 'Remove'} <span className="num">{Number(qty) || 0}</span>{' '}
            {Number(qty) === 1 ? 'unit' : 'units'}
          </Button>
        </FieldGroup>
      </CardContent>

      <div className="mt-5 border-t">
        {movements.length ? (
          <div className="max-h-72 overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_[data-slot=table-container]]:overflow-visible">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px] text-right">Change</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[90px] text-right">Balance</TableHead>
                  <TableHead className="w-[140px] text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell
                      className={cn(
                        'num text-right font-medium',
                        m.quantity > 0 ? 'text-success' : 'text-destructive',
                      )}
                    >
                      {m.quantity > 0 ? '+' : ''}
                      {m.quantity}
                    </TableCell>
                    <TableCell className="max-w-0 truncate">
                      {REASONS.find((r) => r.value === m.reason)?.label ?? m.reason}
                      {m.note ? <span className="text-muted-foreground"> · {m.note}</span> : null}
                    </TableCell>
                    <TableCell className="num text-right">{m.runningTotal}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{dateTime(m.occurredAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyDescription>No stock movements yet.</EmptyDescription>
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
  return (
    <InputGroup>
      <InputGroupInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        inputMode="decimal"
        placeholder="Not set"
        disabled={disabled}
        className="num"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>EGP</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
}
