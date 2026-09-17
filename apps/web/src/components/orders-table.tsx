'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFormat } from '@/i18n/use-format';
import type { Assignee, OrderRow } from '@/lib/api';
import { money } from '@/lib/format';

const NOBODY = 'unassigned';

/**
 * The live orders grid. Selection is intentionally page-scoped: the header
 * checkbox selects exactly the rows the operator can see, so a filter or page
 * change can never apply work to hidden orders.
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

  const toolbar = isAdmin ? (
    <div className="flex min-h-11 flex-wrap items-center gap-2 px-4 py-2">
      <p className="me-auto text-xs text-muted-foreground" aria-live="polite">
        {selected.size > 0 ? t('bulk.selected', { count: selected.size }) : t('bulk.selectionHint')}
      </p>
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

  return (
    <TablePanel minWidth={isAdmin ? '72rem' : '64rem'} toolbar={toolbar} footer={footer}>
      <Table>
        <TableHeader>
          <TableRow>
            {isAdmin ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={selectionState}
                  onCheckedChange={(checked) =>
                    setSelected(checked === true ? new Set(orders.map((order) => order.id)) : new Set())
                  }
                  aria-label={t('bulk.selectAll', { count: orders.length })}
                />
              </TableHead>
            ) : null}
            <TableHead className="w-[120px]">{t('columns.order')}</TableHead>
            <TableHead>{t('columns.customer')}</TableHead>
            <TableHead className="w-[96px]">{t('columns.channel')}</TableHead>
            <TableHead className="w-[140px]">{t('columns.status')}</TableHead>
            <TableHead className="w-[120px]">{t('columns.payment')}</TableHead>
            {isAdmin ? <TableHead className="w-[150px]">{t('columns.assigned')}</TableHead> : null}
            <TableHead className="w-[120px] text-end">{t('columns.total')}</TableHead>
            <TableHead className="w-[110px] text-end">{t('columns.placed')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="relative" data-state={selected.has(order.id) ? 'selected' : undefined}>
              {isAdmin ? (
                <TableCell>
                  <Checkbox
                    className="relative z-20"
                    checked={selected.has(order.id)}
                    onCheckedChange={(checked) => toggle(order.id, checked === true)}
                    aria-label={t('bulk.selectOrder', { number: order.orderNumber })}
                  />
                </TableCell>
              ) : null}
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/orders/${order.id}`}
                    className="num font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {order.orderNumber}
                  </Link>
                  {order.unmappedCount > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <AlertTriangle
                          aria-label={t('unmapped', { count: order.unmappedCount })}
                          className="relative z-10 size-3.5 text-warning"
                        />
                      </TooltipTrigger>
                      <TooltipContent>{t('unmapped', { count: order.unmappedCount })}</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="max-w-0">
                <p className="truncate font-medium"><bdi>{order.customerName}</bdi></p>
                <p className="num truncate text-xs text-muted-foreground"><bdi>{order.customerPhone}</bdi></p>
              </TableCell>
              <TableCell className="text-muted-foreground">{te(`orderSource.${order.source}`)}</TableCell>
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
              <TableCell className="num text-end font-medium">{money(order.total)}</TableCell>
              <TableCell className="text-end text-muted-foreground">{f.date(order.placedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TablePanel>
  );
}
