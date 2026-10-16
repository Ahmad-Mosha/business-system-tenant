'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode } from 'react';
import { AlertTriangle, UsersRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { bulkAssignOrders } from '@/app/(app)/orders/actions';
import { AssignMenu } from '@/components/assign-menu';
import { OrderStatusMenu } from '@/components/order-status-menu';
import { PaymentStatusMenu } from '@/components/payment-status-menu';
import { TablePanel } from '@/components/table-panel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFormat } from '@/i18n/use-format';
import type { Assignee, OrderRow } from '@/lib/api';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';

const NOBODY = 'unassigned';

/**
 * The live orders grid. Selection is intentionally page-scoped: the header
 * checkbox selects exactly the rows the operator can see, so a filter or page
 * change can never apply work to hidden orders.
 *
 * On a phone the same orders read as cards — number, customer and total on
 * top, status and payment (still changeable) underneath — instead of a table
 * that hides everything past the customer off to the side. Selection works in
 * both layouts and stays scoped to this page.
 */
export function OrdersTable({
  orders,
  assignees,
  isAdmin,
  footer,
}: {
  orders: OrderRow[];
  assignees: Assignee[];
  isAdmin: boolean;
  footer: ReactNode;
}) {
  const t = useTranslations('orders');
  const te = useTranslations('enums');
  const tc = useTranslations('common');
  const tn = useTranslations('nouns');
  const status = useTranslations('status');
  const f = useFormat();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [assignee, setAssignee] = useState('');
  const [pending, start] = useTransition();

  const allSelected = orders.length > 0 && selected.size === orders.length;
  const partiallySelected = selected.size > 0 && !allSelected;
  const selectionState = allSelected ? true : partiallySelected ? 'indeterminate' : false;
  const chosenName = assignee === NOBODY
    ? status('unassigned')
    : assignees.find((person) => person.id === assignee)?.name;

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  // Shows only while orders are selected, like a bulk-action bar: an always-on
  // "select orders to assign" strip was a row of noise above every list.
  const toolbar = isAdmin && selected.size > 0 ? (
    <div className="flex min-h-12 flex-wrap items-center gap-3 bg-highlight/5 px-5 py-2.5">
      <UsersRound className="size-4 text-highlight" aria-hidden />
      <p className="me-auto text-sm font-medium" aria-live="polite">
        {t('bulk.selected', { count: selected.size })}
      </p>
      <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}><X />{t('preview.clearSelection')}</Button>
      <Select value={assignee} onValueChange={setAssignee} disabled={pending}>
        <SelectTrigger className="min-w-44">
          <SelectValue placeholder={t('bulk.chooseAssignee')} />
        </SelectTrigger>
        <SelectContent position="popper" align="end">
          <SelectItem value={NOBODY}>{status('unassigned')}</SelectItem>
          <SelectSeparator />
          {assignees.map((person) => (
            <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        disabled={selected.size === 0 || !assignee || pending}
        onClick={() => {
          const ids = [...selected];
          const target = assignee === NOBODY ? null : assignee;
          start(async () => {
            const result = await bulkAssignOrders(ids, target);
            if (!result.ok) {
              toast.error(result.message);
              return;
            }
            toast.success(result.updated === 0
              ? t('bulk.noChanges')
              : target
                ? t('bulk.assigned', { count: result.updated, name: chosenName ?? '' })
                : t('bulk.unassigned', { count: result.updated }));
            setSelected(new Set());
            router.refresh();
          });
        }}
      >
        {t('bulk.assign')}
      </Button>
    </div>
  ) : undefined;

  /** Under the total: how many items, and any the stock can't follow. */
  const items = (order: OrderRow) => (
    <>
      {tn('items', { count: order.itemCount })}
      {order.unmappedCount > 0 ? (
        <span className="text-warning">
          {' · '}
          <AlertTriangle aria-hidden className="inline size-3 align-[-2px]" /> {t('unlinked', { count: order.unmappedCount })}
        </span>
      ) : null}
    </>
  );
  const total = (order: OrderRow) => (
    <span className={cn('num text-[15px] font-semibold', order.status === 'CANCELLED' && 'text-muted-foreground')}>
      {money(order.total)} <span className="text-xs font-normal text-muted-foreground">{tc('egp')}</span>
    </span>
  );
  const select = (order: OrderRow) => (
    <Checkbox
      className="relative z-20"
      checked={selected.has(order.id)}
      onCheckedChange={(checked) => toggle(order.id, checked === true)}
      aria-label={t('bulk.selectOrder', { number: order.orderNumber })}
    />
  );
  const link = (order: OrderRow) => (
    <Link
      href={`/orders/${order.id}`}
      className="num font-semibold after:absolute after:inset-0 hover:text-highlight hover:underline hover:underline-offset-4 focus-visible:underline focus-visible:outline-none"
    >
      {order.orderNumber}
    </Link>
  );
  const contact = (order: OrderRow) =>
    [order.customerPhone, te(`orderSource.${order.source}`), order.governorate].filter(Boolean).map((part, i) => (
      <span key={i}>{i > 0 ? <span aria-hidden> · </span> : null}<bdi className={i === 0 ? 'num' : undefined}>{part}</bdi></span>
    ));

  return (
    <TablePanel minWidth={isAdmin ? '60rem' : '50rem'} toolbar={toolbar} footer={footer}>
      <ul className="divide-y lg:hidden">
        {orders.map((order) => (
          <li key={order.id} className="relative px-5 py-4" data-state={selected.has(order.id) ? 'selected' : undefined}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  {isAdmin ? select(order) : null}
                  {link(order)}
                  <span className="text-xs text-muted-foreground">{f.date(order.placedAt)}</span>
                </div>
                <p className="mt-1.5 truncate font-medium"><bdi>{order.customerName}</bdi></p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{contact(order)}</p>
              </div>
              <div className="shrink-0 text-end">
                {total(order)}
                <p className="mt-1 text-xs text-muted-foreground">{items(order)}</p>
              </div>
            </div>
            <div className="relative z-10 mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t pt-2.5 text-[13px]">
              <OrderStatusMenu orderId={order.id} status={order.status} canRevert={isAdmin} />
              <PaymentStatusMenu orderId={order.id} status={order.paymentStatus} orderStatus={order.status} />
              {isAdmin ? (
                <AssignMenu
                  orderId={order.id}
                  assignedToId={order.assignedToId}
                  assignedToName={order.assignedToName}
                  assignees={assignees}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Table className="hidden lg:table [&_td]:h-[4.5rem]">
        <TableHeader>
          <TableRow>
            {isAdmin ? (
              <TableHead className="w-12">
                <Checkbox
                  checked={selectionState}
                  onCheckedChange={(checked) =>
                    setSelected(checked === true ? new Set(orders.map((order) => order.id)) : new Set())
                  }
                  aria-label={t('bulk.selectAll', { count: orders.length })}
                />
              </TableHead>
            ) : null}
            <TableHead className="w-[14%]">{t('columns.order')}</TableHead>
            <TableHead>{t('columns.customer')}</TableHead>
            <TableHead className="w-[14%]">{t('columns.status')}</TableHead>
            <TableHead className="w-[13%]">{t('columns.payment')}</TableHead>
            {isAdmin ? <TableHead className="w-[15%]">{t('columns.assigned')}</TableHead> : null}
            <TableHead className="w-[15%] text-end">{t('columns.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="relative" data-state={selected.has(order.id) ? 'selected' : undefined}>
              {isAdmin ? <TableCell>{select(order)}</TableCell> : null}
              <TableCell>
                {link(order)}
                <p className="mt-1 text-xs text-muted-foreground">{f.date(order.placedAt)}</p>
              </TableCell>
              <TableCell className="max-w-0">
                <p className="truncate font-medium"><bdi>{order.customerName}</bdi></p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{contact(order)}</p>
              </TableCell>
              <TableCell>
                <OrderStatusMenu orderId={order.id} status={order.status} canRevert={isAdmin} />
              </TableCell>
              <TableCell>
                <PaymentStatusMenu orderId={order.id} status={order.paymentStatus} orderStatus={order.status} />
              </TableCell>
              {isAdmin ? (
                <TableCell className="max-w-0">
                  <AssignMenu
                    orderId={order.id}
                    assignedToId={order.assignedToId}
                    assignedToName={order.assignedToName}
                    assignees={assignees}
                  />
                </TableCell>
              ) : null}
              <TableCell className="text-end">
                {total(order)}
                <p className="mt-1 text-xs text-muted-foreground">{items(order)}</p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TablePanel>
  );
}
