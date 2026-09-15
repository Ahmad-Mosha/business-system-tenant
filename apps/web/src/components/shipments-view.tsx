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
import { useTranslations } from 'next-intl';
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
import { cn, isOneOf } from '@/lib/utils';
import { b, bdi, num } from '@/i18n/rich';
import { useFormat } from '@/i18n/use-format';

const FILTERS = ['ALL', 'DELIVERED', 'IN_TRANSIT', 'DELAYED'] as const;
type Filter = (typeof FILTERS)[number];

/** The states the API names (BostaService.mapBostaStatus); anything else is Bosta's own text. */
const SHIPMENT_STATUSES = [
  'NEW',
  'AWAITING_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
] as const;
/** BostaService.buildTimeline's fixed steps. */
const STEPS = ['NEW', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'] as const;

const isDelivered = (s: ShipmentTracking) => s.status === 'DELIVERED';
const isReturned = (s: ShipmentTracking) => s.status === 'RETURNED' || s.status === 'CANCELLED';

/** The badge: Bosta's dashboard wording for the two endings, the live state otherwise. */
function useStatusOf() {
  const t = useTranslations('shipments');
  const te = useTranslations('enums.shipmentStatus');
  return (s: ShipmentTracking): { tone: Tone; label: string } => {
    if (isDelivered(s)) return { tone: 'success', label: t('deliveredBadge') };
    if (isReturned(s)) return { tone: 'danger', label: t('returnedBadge') };
    const label = isOneOf(SHIPMENT_STATUSES, s.status) ? te(s.status) : s.statusLabel;
    return { tone: s.isDelayed ? 'warning' : 'progress', label };
  };
}

const COLLECTION_TONE: Record<string, Tone> = { PAID: 'success', UNPAID: 'danger', PENDING: 'muted' };

/** Bosta's package type, sized the way its dashboard names it. */
const packageSize = (type?: string | null) => {
  const v = (type ?? '').toLowerCase();
  if (!v) return 'none';
  if (v.includes('small')) return 'small';
  return v.includes('medium') || v.includes('light') ? 'medium' : 'other';
};

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
  const t = useTranslations('shipments');
  const tr = useTranslations();
  const f = useFormat();
  const statusOf = useStatusOf();
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
          toast.success(t('refreshed', { number: tn }));
        } else {
          const next = await Promise.all(
            shipments.map(async (s) => {
              const r = await trackBostaLive(s.trackingNumber);
              return r.ok ? r.data : s;
            }),
          );
          setShipments(next);
          toast.success(t('refreshedAll'));
        }
      } catch {
        toast.error(t('refreshFailed'));
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
  const by = (v: string) => t.rich('by', { date: f.dateTime(v), bdi });

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
            placeholder={t('search')}
            aria-label={t('searchLabel')}
          />
          {search ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={tr('filters.clearSearch')}
                onClick={() => setSearch('')}
              >
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
          aria-label={t('filterLabel')}
        >
          {FILTERS.map((value) => (
            <ToggleGroupItem key={value} value={value} className="gap-1.5">
              {t(`filter.${value}`)}
              <span className="num opacity-60">{count(value)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Button variant="outline" className="ms-auto" disabled={refreshing} onClick={() => refresh()}>
          <RefreshCw className={cn(refreshing && 'animate-spin')} />
          {t('refreshAll')}
        </Button>
      </div>

      <TablePanel
        minWidth="60rem"
        footer={
          <TableCount>
            {tr.rich('table.shownOf', {
              shown: rows.length,
              items: tr('nouns.shipments', { count: shipments.length }),
              b,
            })}
          </TableCount>
        }
      >
        {rows.length === 0 ? (
          <TableEmpty
            icon={Truck}
            title={shipments.length ? t('noMatch') : t('none')}
            description={shipments.length ? t('noMatchHint') : t('noneHint')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.tracking')}</TableHead>
                <TableHead>{t('columns.customer')}</TableHead>
                <TableHead>{t('columns.destination')}</TableHead>
                <TableHead className="text-end">{t('columns.cod')}</TableHead>
                <TableHead className="text-end">{t('columns.flexShip')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead className="text-center">{t('columns.attempts')}</TableHead>
                <TableHead>{t('columns.collection')}</TableHead>
                <TableHead className="text-end">{t('columns.deliveredAt')}</TableHead>
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
                        {`#${s.trackingNumber}`}
                      </button>
                      <span className="block text-xs text-muted-foreground">
                        {t('package', {
                          size: packageSize(s.packageSpecs?.type),
                          type: s.packageSpecs?.type ?? '',
                        })}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <p className="truncate font-medium">
                        <bdi>{s.receiver.name}</bdi>
                      </p>
                      <p className="num truncate text-xs text-muted-foreground">
                        <bdi>{s.receiver.phone}</bdi>
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate">
                        <bdi>
                          {[s.destination.city, s.destination.zone].filter(Boolean).join(' - ') ||
                            t('egypt')}
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
                      <p className="text-xs text-muted-foreground">{tr('enums.paymentMethod.COD')}</p>
                    </TableCell>
                    <TableCell className="text-end">
                      <p className="num">{s.flexShipFee ? money(s.flexShipFee) : '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.flexShipFee != null ? t('flexShipDue') : t('flexShipNone')}
                      </p>
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
                    </TableCell>
                    <TableCell className="num text-center text-muted-foreground">
                      {`${s.attempts.count} / ${s.attempts.max}`}
                    </TableCell>
                    <TableCell>
                      <ToneBadge tone={COLLECTION_TONE[collection] ?? 'muted'}>
                        {tr(`enums.codCollection.${collection}`)}
                      </ToneBadge>
                    </TableCell>
                    <TableCell className="text-end text-xs text-muted-foreground">
                      {s.deliveredAt ? (
                        <>
                          <p className="text-[13px] text-foreground">
                            <bdi>{f.dateTime(s.deliveredAt)}</bdi>
                          </p>
                          {s.scheduledDeliveryDate ? <p>{by(s.scheduledDeliveryDate)}</p> : null}
                        </>
                      ) : s.scheduledDeliveryDate ? (
                        <p>{by(s.scheduledDeliveryDate)}</p>
                      ) : s.updatedAt ? (
                        <p>
                          <bdi>{f.dateTime(s.updatedAt)}</bdi>
                        </p>
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

/** Bosta's own view of one delivery. */
function ShipmentDetail({
  s,
  refreshing,
  onRefresh,
}: {
  s: ShipmentTracking;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const t = useTranslations('shipments');
  const tr = useTranslations();
  const f = useFormat();
  const status = useStatusOf()(s);
  const collection = s.cod?.collectionStatus ?? 'PENDING';
  const dated = (key: 'deliveredAlertOn' | 'whatsAppOn' | 'created', v: string) =>
    t.rich(key, { date: f.dateTime(v), bdi });

  return (
    <>
      <SheetHeader className="gap-2 border-b pe-12">
        <div className="flex flex-wrap items-center gap-2">
          <SheetTitle className="text-base">
            {t.rich('detailTitle', { number: s.trackingNumber, num })}
          </SheetTitle>
          <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
        </div>
        <SheetDescription>
          {s.createdAt ? dated('created', s.createdAt) : t('createdViaBosta')}
        </SheetDescription>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={refreshing} onClick={onRefresh}>
            <RefreshCw className={cn(refreshing && 'animate-spin')} />
            {tr('common.refresh')}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://bosta.co/tracking?trackingNumber=${s.trackingNumber}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              {t('openInBosta')}
            </a>
          </Button>
        </div>
      </SheetHeader>

      <div className="grid flex-1 content-start gap-5 overflow-y-auto p-4 text-[13px]">
        {isDelivered(s) ? (
          <Alert variant="success">
            <CheckCircle2 />
            <AlertDescription>
              {s.deliveredAt ? dated('deliveredAlertOn', s.deliveredAt) : t('deliveredAlert')}
            </AlertDescription>
          </Alert>
        ) : null}
        {s.whatsAppConfirmation?.isConfirmed ? (
          <Alert variant="success">
            <MessageSquare />
            <AlertDescription>
              {s.whatsAppConfirmation.confirmedAt
                ? dated('whatsAppOn', s.whatsAppConfirmation.confirmedAt)
                : t('whatsApp')}
            </AlertDescription>
          </Alert>
        ) : null}

        {s.timeline?.length ? (
          <section className="grid gap-3">
            <h3 className="text-xs font-medium text-muted-foreground">{t('progress')}</h3>
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
                    <p className={cn('font-medium', !step.isDone && 'text-muted-foreground')}>
                      {isOneOf(STEPS, step.key) ? t(`steps.${step.key}`) : step.label}
                    </p>
                    {step.date ? (
                      <p className="text-xs text-muted-foreground">
                        <bdi>{f.dateTime(step.date)}</bdi>
                      </p>
                    ) : null}
                    {step.description ? (
                      <p className="text-xs text-muted-foreground">
                        <bdi>{step.description}</bdi>
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <Separator />

        <section className="grid gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">{t('customerAndDelivery')}</h3>
          <p className="text-sm font-medium">
            <bdi>{s.receiver.name}</bdi>
          </p>
          <p className="num text-muted-foreground">
            <bdi>{s.receiver.phone}</bdi>
          </p>
          <p>
            <bdi>
              {[s.destination.city, s.destination.zone, s.destination.district].filter(Boolean).join(' - ')}
            </bdi>
          </p>
          {s.destination.address ? (
            <p className="text-muted-foreground">
              <bdi>{s.destination.address}</bdi>
            </p>
          ) : null}
        </section>

        <Separator />

        <section className="grid gap-2">
          <h3 className="text-xs font-medium text-muted-foreground">{t('paymentAndCollection')}</h3>
          <dl className="grid gap-2">
            <Line label={t('codAmount')}>
              <span className="num font-semibold">{money(s.cod?.amount ?? 0)}</span>
            </Line>
            <Line label={t('collectionStatus')}>
              <ToneBadge tone={COLLECTION_TONE[collection] ?? 'muted'}>
                {tr(`enums.codCollection.${collection}`)}
              </ToneBadge>
            </Line>
            <Line label={t('columns.flexShip')}>
              <span className="num">{s.flexShipFee ? money(s.flexShipFee) : '—'}</span>
            </Line>
            <Line label={t('attempts')}>
              <span>{t.rich('attemptsValue', { count: s.attempts.count, max: s.attempts.max, num })}</span>
            </Line>
            <Line label={t('allowOpen')}>{s.allowOpenPackage ? tr('common.yes') : tr('common.no')}</Line>
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
