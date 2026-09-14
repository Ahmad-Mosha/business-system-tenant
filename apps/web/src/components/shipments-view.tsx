'use client';

import {
  Check,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  SearchIcon,
  Truck,
  X,
} from 'lucide-react';
import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { trackBostaLive } from '@/app/(app)/orders/actions';
import { TableCount, TableEmpty, TablePanel } from '@/components/table-panel';
import { ToneBadge, type Tone } from '@/components/tone-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ShipmentTracking } from '@/lib/api';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFormat } from '@/i18n/use-format';

type Filter = 'ALL' | 'DELIVERED' | 'IN_TRANSIT' | 'DELAYED';

const isDelivered = (s: ShipmentTracking) => s.status === 'DELIVERED';
const isReturned = (s: ShipmentTracking) => s.status === 'RETURNED' || s.status === 'CANCELLED';

function statusOf(s: ShipmentTracking): { tone: Tone; label: string } {
  if (isDelivered(s)) return { tone: 'success', label: 'تم بنجاح' };
  if (isReturned(s)) return { tone: 'danger', label: 'تم الاسترجاع' };
  if (s.isDelayed) return { tone: 'warning', label: s.statusLabel };
  return { tone: 'progress', label: s.statusLabel };
}

const COLLECTION_TONE: Record<string, Tone> = { PAID: 'success', UNPAID: 'danger', PENDING: 'muted' };

/** A date inside Arabic text, isolated — otherwise the bidi algorithm drags its
 *  digits across the words ("17 بحد أقصى Sept"). */
const isolate = (text: string) => <bdi>{text}</bdi>;

const MATCHES: Record<Filter, (s: ShipmentTracking) => boolean> = {
  ALL: () => true,
  DELIVERED: isDelivered,
  IN_TRANSIT: (s) => !isDelivered(s) && !s.isDelayed,
  DELAYED: (s) => s.isDelayed,
};

/**
 * The live Bosta board. Client-side because it's refreshed live, one row or
 * all of them, without a page load — the list is every active shipment, so
 * searching and filtering it in the browser is instant.
 */
export function ShipmentsView({ initialShipments }: { initialShipments: ShipmentTracking[] }) {
  const f = useFormat();
  const when = (v: string) => isolate(f.dateTime(v));
  const [shipments, setShipments] = useState(initialShipments);
  const [selected, setSelected] = useState<ShipmentTracking | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [refreshing, startRefresh] = useTransition();

  const refresh = (tn?: string) =>
    startRefresh(async () => {
      try {
        if (tn) {
          const res = await trackBostaLive(tn);
          if (!res.ok) {
            toast.error(res.message);
            return;
          }
          setShipments((prev) => prev.map((s) => (s.trackingNumber === tn ? res.data : s)));
          setSelected((cur) => (cur?.trackingNumber === tn ? res.data : cur));
          toast.success(`Refreshed #${tn}`);
        } else {
          const next = await Promise.all(
            shipments.map(async (s) => {
              const r = await trackBostaLive(s.trackingNumber);
              return r.ok ? r.data : s;
            }),
          );
          setShipments(next);
          toast.success('Live Bosta shipments refreshed');
        }
      } catch {
        toast.error('Failed to refresh live data');
      }
    });

  const q = search.toLowerCase().trim();
  const rows = shipments.filter((s) => {
    const hit =
      !q ||
      s.trackingNumber.toLowerCase().includes(q) ||
      s.receiver.name.toLowerCase().includes(q) ||
      s.receiver.phone.includes(q) ||
      [s.destination.city, s.destination.zone, s.destination.district].some((v) =>
        v?.toLowerCase().includes(q),
      );
    return hit && MATCHES[filter](s);
  });
  const count = (f: Filter) => shipments.filter(MATCHES[f]).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tracking #, customer, phone, zone…"
            aria-label="Search shipments"
          />
          {search ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setSearch('')}>
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>

        <ToggleGroup
          type="single"
          variant="outline"
          spacing={0}
          value={filter}
          onValueChange={(v) => v && setFilter(v as Filter)}
          aria-label="Filter by status"
        >
          {(
            [
              ['ALL', 'All'],
              ['DELIVERED', 'Delivered'],
              ['IN_TRANSIT', 'In transit'],
              ['DELAYED', 'Delayed'],
            ] as const
          ).map(([value, label]) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="gap-1.5"
            >
              {label}
              <span className="num opacity-60">{count(value)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Button variant="outline" className="ms-auto" disabled={refreshing} onClick={() => refresh()}>
          <RefreshCw className={cn(refreshing && 'animate-spin')} />
          Refresh live data
        </Button>
      </div>

      <TablePanel
        minWidth="60rem"
        footer={
          <TableCount>
            <span className="num font-medium text-foreground">{rows.length}</span> of{' '}
            <span className="num">{shipments.length}</span> shipments
          </TableCount>
        }
      >
        {rows.length === 0 ? (
          <TableEmpty
            icon={Truck}
            title={shipments.length ? 'No shipments match' : 'No live shipments'}
            description={
              shipments.length
                ? 'Try another status, or clear the search.'
                : 'Shipments appear here as soon as Bosta has them.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم التتبع / Type</TableHead>
                <TableHead>العميل / Customer</TableHead>
                <TableHead>المنطقة / Destination</TableHead>
                <TableHead className="text-end">مبلغ التحصيل (COD)</TableHead>
                <TableHead className="text-end">رسوم فليكس شيب</TableHead>
                <TableHead>الحالة / Status</TableHead>
                <TableHead className="text-center">المحاولات</TableHead>
                <TableHead>حالة المبلغ المحصل</TableHead>
                <TableHead className="text-end">وقت التوصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const status = statusOf(s);
                const collection = s.cod?.collectionStatus ?? 'PENDING';
                return (
                  <TableRow
                    key={s.trackingNumber}
                    data-state={selected?.trackingNumber === s.trackingNumber ? 'selected' : undefined}
                    className="relative cursor-pointer"
                  >
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelected(s)}
                        className="num block font-medium after:absolute after:inset-0 hover:underline focus-visible:underline focus-visible:outline-none"
                      >
                        #{s.trackingNumber}
                      </button>
                      <span className="block text-xs text-muted-foreground">
                        {s.packageSpecs?.typeAr ||
                          (s.packageSpecs?.type ? `توصيل ${s.packageSpecs.type}` : 'توصيل')}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <p className="truncate font-medium">
                        <bdi>{s.receiver.name}</bdi>
                      </p>
                      <p className="num truncate text-xs text-muted-foreground">{s.receiver.phone}</p>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate">
                        <bdi>
                          {[s.destination.city, s.destination.zone].filter(Boolean).join(' - ') ||
                            'Egypt'}
                        </bdi>
                      </p>
                      {s.destination.district ? (
                        <p className="truncate text-xs text-muted-foreground">
                          <bdi>{s.destination.district}</bdi>
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-end">
                      <p className="num font-medium">{money(s.cod?.amount ?? 0)}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.cod?.paymentMethodLabel || 'الدفع عند الاستلام'}
                      </p>
                    </TableCell>
                    <TableCell className="text-end">
                      <p className="num">{s.flexShipFee ? money(s.flexShipFee) : '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.flexShipStatusLabel || 'غير مستحق بعد'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
                    </TableCell>
                    <TableCell className="num text-center text-muted-foreground">
                      {s.attempts.count} / {s.attempts.max}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={COLLECTION_TONE[collection] ?? 'muted'}>
                        {s.cod?.collectionStatusLabel ?? 'قيد التنفيذ'}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="text-end text-xs text-muted-foreground">
                      {s.deliveredAt ? (
                        <>
                          <p className="text-[13px] text-foreground">{when(s.deliveredAt)}</p>
                          {s.scheduledDeliveryDate ? (
                            <p>بحد أقصى {when(s.scheduledDeliveryDate)}</p>
                          ) : null}
                        </>
                      ) : s.scheduledDeliveryDate ? (
                        <p>بحد أقصى {when(s.scheduledDeliveryDate)}</p>
                      ) : s.updatedAt ? (
                        <p>{when(s.updatedAt)}</p>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TablePanel>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          {selected ? (
            <ShipmentDetail
              s={selected}
              refreshing={refreshing}
              onRefresh={() => refresh(selected.trackingNumber)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Bosta's own view of one delivery, in Bosta's own (Arabic) words. */
function ShipmentDetail({
  s,
  refreshing,
  onRefresh,
}: {
  s: ShipmentTracking;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const f = useFormat();
  const when = (v: string) => isolate(f.dateTime(v));
  const status = statusOf(s);
  const collection = s.cod?.collectionStatus ?? 'PENDING';

  return (
    <>
      <SheetHeader className="gap-2 border-b pe-12">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle className="text-base">
            توصيل <bdi className="num">#{s.trackingNumber}</bdi>
          </SheetTitle>
          <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
        </div>
        <SheetDescription>
          انشئ: {s.createdAt ? when(s.createdAt) : 'عبر Bosta'}
        </SheetDescription>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://bosta.co/tracking?trackingNumber=${s.trackingNumber}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              Open in Bosta
            </a>
          </Button>
        </div>
      </SheetHeader>

      <div dir="rtl" className="grid flex-1 content-start gap-5 overflow-y-auto p-4 text-[13px]">
        {isDelivered(s) ? (
          <Alert variant="success">
            <CheckCircle2 />
            <AlertDescription>
              تم تسليم الأوردر لعميلك بنجاح{s.deliveredAt ? <> في {when(s.deliveredAt)}</> : null}.
            </AlertDescription>
          </Alert>
        ) : null}
        {s.whatsAppConfirmation?.isConfirmed ? (
          <Alert variant="success">
            <MessageSquare />
            <AlertDescription>
              تواصل مع العميل عبر الواتس آب: تم تأكيد التوصيل{' '}
              {s.whatsAppConfirmation.confirmedAt ? when(s.whatsAppConfirmation.confirmedAt) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {s.timeline?.length ? (
          <section className="grid gap-3">
            <h3 className="text-xs font-medium text-muted-foreground">تتبع الأوردر / Delivery Progress</h3>
            <ol className="grid gap-3">
              {s.timeline.map((step, i) => (
                <li key={step.key} className="flex gap-3">
                  <span
                    className={cn(
                      'num flex size-6 shrink-0 items-center justify-center text-xs font-semibold',
                      step.isDone ? 'bg-primary text-primary-foreground' : 'border bg-muted text-muted-foreground',
                    )}
                  >
                    {step.isDone ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={cn('font-medium', !step.isDone && 'text-muted-foreground')}>{step.label}</p>
                    {step.date ? (
                      <p className="text-xs text-muted-foreground">{when(step.date)}</p>
                    ) : null}
                    {step.description ? (
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <Separator />

        <section className="grid gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">بيانات العميل والتسليم</h3>
          <p className="text-sm font-medium">{s.receiver.name}</p>
          <p className="num text-muted-foreground" dir="ltr">
            {s.receiver.phone}
          </p>
          <p>
            {[s.destination.city, s.destination.zone, s.destination.district].filter(Boolean).join(' - ')}
          </p>
          {s.destination.address ? (
            <p className="text-muted-foreground">{s.destination.address}</p>
          ) : null}
        </section>

        <Separator />

        <section className="grid gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">تفاصيل العملية والتحصيل</h3>
          <dl className="grid gap-2">
            <Line label="مبلغ التحصيل (COD)">
              <span className="num font-semibold">{money(s.cod?.amount ?? 0)}</span>
            </Line>
            <Line label="حالة المبلغ المحصل">
              <ToneBadge tone={COLLECTION_TONE[collection] ?? 'muted'}>
                {s.cod?.collectionStatusLabel ?? 'قيد التنفيذ'}
              </ToneBadge>
            </Line>
            <Line label="تطبيق فليكس شيب">
              <span className="num">{s.flexShipFee ? money(s.flexShipFee) : '—'}</span>
            </Line>
            <Line label="محاولات التوصيل">
              <span>
                <span className="num">{s.attempts.count}</span> من أصل{' '}
                <span className="num">{s.attempts.max}</span> محاولات
              </span>
            </Line>
            <Line label="السماح للعميل بفتح الشحنة؟">{s.allowOpenPackage ? 'نعم (Yes)' : 'لا'}</Line>
          </dl>
        </section>
      </div>
    </>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed pb-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
