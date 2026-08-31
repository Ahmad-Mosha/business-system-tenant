'use client';

import {
  AlertTriangle,
  ArrowUpRight,
  Battery,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  RefreshCw,
  Search,
  Truck,
  X,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { trackBostaLive } from '@/app/(app)/orders/actions';
import type { ShipmentTracking } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { cn } from '@/lib/utils';

export function ShipmentsView({
  initialShipments,
}: {
  initialShipments: ShipmentTracking[];
}) {
  const [shipments, setShipments] = useState<ShipmentTracking[]>(initialShipments);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentTracking | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [refreshing, startRefresh] = useTransition();

  const handleRefresh = (tn?: string) => {
    startRefresh(async () => {
      try {
        if (tn) {
          const res = await trackBostaLive(tn);
          if (res.ok) {
            setShipments((prev) =>
              prev.map((s) => (s.trackingNumber === tn ? res.data : s)),
            );
            if (selectedShipment?.trackingNumber === tn) {
              setSelectedShipment(res.data);
            }
            toast.success(`Refreshed #${tn}`);
          }
        } else {
          const refreshed = await Promise.all(
            shipments.map(async (s) => {
              const r = await trackBostaLive(s.trackingNumber);
              return r.ok ? r.data : s;
            }),
          );
          setShipments(refreshed);
          toast.success('Live Bosta shipments refreshed');
        }
      } catch {
        toast.error('Failed to refresh live data');
      }
    });
  };

  const copy = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const filtered = shipments.filter((s) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      s.trackingNumber.toLowerCase().includes(q) ||
      s.receiver.name.toLowerCase().includes(q) ||
      s.receiver.phone.includes(q) ||
      (s.destination.city && s.destination.city.toLowerCase().includes(q)) ||
      (s.destination.zone && s.destination.zone.toLowerCase().includes(q)) ||
      (s.destination.district && s.destination.district.toLowerCase().includes(q));

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'DELIVERED' && s.status === 'DELIVERED') ||
      (statusFilter === 'IN_TRANSIT' && s.status !== 'DELIVERED' && !s.isDelayed) ||
      (statusFilter === 'DELAYED' && s.isDelayed);

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1 sm:max-w-[360px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracking #, customer, phone, zone..."
            className="h-9 w-full rounded-md border border-border bg-background pr-8 pl-9 text-xs placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
          {[
            { id: 'ALL', label: `All (${shipments.length})` },
            {
              id: 'DELIVERED',
              label: `Delivered (${shipments.filter((s) => s.status === 'DELIVERED').length})`,
            },
            {
              id: 'IN_TRANSIT',
              label: `In Transit (${shipments.filter((s) => s.status !== 'DELIVERED' && !s.isDelayed).length})`,
            },
            {
              id: 'DELAYED',
              label: `Delayed (${shipments.filter((s) => s.isDelayed).length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                statusFilter === tab.id
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => handleRefresh()}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          Refresh live data
        </button>
      </div>

      {/* Shipments Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
          No shipments match the current search or filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-muted/20 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">رقم التتبع / Type</th>
                <th className="px-4 py-3 font-medium">العميل / Customer</th>
                <th className="px-4 py-3 font-medium">المنطقة / Destination</th>
                <th className="px-4 py-3 font-medium text-right">مبلغ التحصيل (COD)</th>
                <th className="px-4 py-3 font-medium text-right">رسوم فليكس شيب</th>
                <th className="px-4 py-3 font-medium text-center">الحالة / Status</th>
                <th className="px-4 py-3 font-medium text-center">المحاولات</th>
                <th className="px-4 py-3 font-medium text-center">حالة المبلغ المحصل</th>
                <th className="px-4 py-3 font-medium text-right whitespace-nowrap">وقت التوصيل</th>
                <th className="w-8 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s) => {
                const isDelivered = s.status === 'DELIVERED';
                const isReturnedOrDead = s.status === 'RETURNED' || s.status === 'CANCELLED';
                const isSelected = selectedShipment?.trackingNumber === s.trackingNumber;
                const collection = s.cod?.collectionStatus ?? 'PENDING';

                return (
                  <tr
                    key={s.trackingNumber}
                    onClick={() => setSelectedShipment(s)}
                    className={cn(
                      'group cursor-pointer transition-colors hover:bg-accent/50',
                      isSelected && 'bg-accent/70',
                    )}
                  >
                    {/* Tracking # & Type */}
                    <td className="px-4 py-3 font-mono">
                      <span className="block font-semibold tabular-nums text-foreground">
                        #{s.trackingNumber}
                      </span>
                      <span className="block font-sans text-[11px] text-muted-foreground">
                        {s.packageSpecs?.typeAr || (s.packageSpecs?.type ? `توصيل ${s.packageSpecs.type}` : 'توصيل')}
                      </span>
                    </td>

                    {/* Customer */}
                    <td className="max-w-[180px] px-4 py-3">
                      <p className="truncate font-medium text-foreground">{s.receiver.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {s.receiver.phone}
                      </p>
                    </td>

                    {/* Destination Zone/City */}
                    <td className="max-w-[200px] px-4 py-3 text-muted-foreground">
                      <p className="truncate font-medium text-foreground">
                        {[s.destination.city, s.destination.zone].filter(Boolean).join(' - ') || 'Egypt'}
                      </p>
                      {s.destination.district && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {s.destination.district}
                        </p>
                      )}
                    </td>

                    {/* COD Amount */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      <p className="font-semibold text-foreground">{money(s.cod?.amount ?? 0)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.cod?.paymentMethodLabel || 'الدفع عند الاستلام'}
                      </p>
                    </td>

                    {/* FlexShip Fee */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      <p className="font-medium text-foreground">
                        {s.flexShipFee ? money(s.flexShipFee) : '0.00 EGP'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {s.flexShipStatusLabel || 'غير مستحق بعد'}
                      </p>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
                          isDelivered
                            ? 'border-success/30 bg-success-subtle text-success dark:border-success/30 dark:bg-success-subtle dark:text-success'
                            : isReturnedOrDead
                              ? 'border-destructive/30 bg-destructive-subtle text-destructive'
                              : s.isDelayed
                                ? 'border-warning/30 bg-warning-subtle text-warning'
                                : 'border-border bg-muted text-foreground',
                        )}
                      >
                        {isDelivered ? <Check className="size-3 stroke-[2.5]" /> : null}
                        {isDelivered ? 'تم بنجاح' : isReturnedOrDead ? 'تم الاسترجاع' : s.statusLabel}
                      </span>
                    </td>

                    {/* Attempts */}
                    <td className="px-4 py-3 text-center font-mono text-xs tabular-nums text-muted-foreground">
                      <div className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px]">
                        <span className="size-1.5 rounded-full bg-success" />
                        <span>
                          {s.attempts.count}/{s.attempts.max}
                        </span>
                      </div>
                    </td>

                    {/* Collected Amount Status (حالة المبلغ المحصل) */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap border',
                          collection === 'PAID' &&
                            'border-success/30 bg-success-subtle text-success',
                          collection === 'UNPAID' &&
                            'border-destructive/30 bg-destructive-subtle text-destructive',
                          collection === 'PENDING' &&
                            'border-border bg-muted text-muted-foreground',
                        )}
                      >
                        {s.cod?.collectionStatusLabel ?? 'قيد التحصيل'}
                      </span>
                    </td>

                    {/* Delivery Time / SLA */}
                    <td className="px-4 py-3 text-right whitespace-nowrap text-xs text-muted-foreground">
                      {s.deliveredAt ? (
                        <div>
                          <p className="font-medium text-foreground">{dateTime(s.deliveredAt)}</p>
                          {s.scheduledDeliveryDate && (
                            <p className="text-[10px] text-muted-foreground">
                              بحد أقصى {dateTime(s.scheduledDeliveryDate)}
                            </p>
                          )}
                        </div>
                      ) : s.scheduledDeliveryDate ? (
                        <p>بحد أقصى {dateTime(s.scheduledDeliveryDate)}</p>
                      ) : s.updatedAt ? (
                        <p>{dateTime(s.updatedAt)}</p>
                      ) : (
                        <span>—</span>
                      )}
                    </td>

                    <td className="px-2 py-3 text-right text-muted-foreground/40 group-hover:text-foreground">
                      <ChevronRight className="size-4" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Selected Shipment Detail View Modal (Screenshot 2 fidelity) */}
      {selectedShipment && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedShipment(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
                    <Truck className="size-3.5" />
                  </span>
                  <h2 className="font-mono text-lg font-bold tracking-tight text-foreground">
                    توصيل #{selectedShipment.trackingNumber}
                  </h2>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                      selectedShipment.status === 'DELIVERED'
                        ? 'border-success/30 bg-success-subtle text-success'
                        : selectedShipment.status === 'RETURNED' || selectedShipment.status === 'CANCELLED'
                          ? 'border-destructive/30 bg-destructive-subtle text-destructive'
                          : 'border-border bg-muted text-foreground',
                    )}
                  >
                    {selectedShipment.status === 'DELIVERED' && <Check className="size-3 stroke-[2.5]" />}
                    {selectedShipment.status === 'DELIVERED'
                      ? 'تم بنجاح'
                      : selectedShipment.status === 'RETURNED' || selectedShipment.status === 'CANCELLED'
                        ? 'تم الاسترجاع'
                        : selectedShipment.statusLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground">
                    مؤكد
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  انشئ: {selectedShipment.createdAt ? dateTime(selectedShipment.createdAt) : 'عبر Bosta'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() => handleRefresh(selectedShipment.trackingNumber)}
                  title="Refresh"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
                </button>
                <a
                  href={`https://bosta.co/tracking?trackingNumber=${selectedShipment.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink className="size-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedShipment(null)}
                  className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Banner: Delivery Success */}
            {selectedShipment.status === 'DELIVERED' && (
              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-success/30 bg-success-subtle px-4 py-3 text-xs font-medium text-success dark:text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  تم تسليم الأوردر لعميلك بنجاح
                  {selectedShipment.deliveredAt ? ` في ${dateTime(selectedShipment.deliveredAt)}` : ''}.
                </span>
              </div>
            )}

            {/* WhatsApp Confirmation Banner */}
            {selectedShipment.whatsAppConfirmation?.isConfirmed && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-success/30 bg-success-subtle px-4 py-2.5 text-xs text-success dark:text-success">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 shrink-0 text-success dark:text-success" />
                  <span>
                    تواصل مع العميل عبر الواتس آب: تم تأكيد التوصيل{' '}
                    {selectedShipment.whatsAppConfirmation.confirmedAt
                      ? dateTime(selectedShipment.whatsAppConfirmation.confirmedAt)
                      : ''}
                  </span>
                </div>
                <span className="font-semibold text-success dark:text-success">مؤكد</span>
              </div>
            )}

            {/* 5-Step Delivery Timeline */}
            {selectedShipment.timeline && selectedShipment.timeline.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  تتبع الأوردر / Delivery Progress
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {selectedShipment.timeline.map((step, idx) => {
                    const isLast = idx === selectedShipment.timeline.length - 1;
                    return (
                      <div key={step.key} className="relative flex flex-col">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                              step.isDone
                                ? 'bg-foreground text-background'
                                : 'border border-border bg-muted/40 text-muted-foreground',
                            )}
                          >
                            {step.isDone ? <Check className="size-3.5 stroke-[2.5]" /> : idx + 1}
                          </span>
                          {!isLast && (
                            <span
                              className={cn(
                                'hidden h-0.5 flex-1 sm:block',
                                step.isDone ? 'bg-foreground' : 'bg-border',
                              )}
                            />
                          )}
                        </div>
                        <div className="mt-2 min-w-0">
                          <p
                            className={cn(
                              'text-xs font-medium',
                              step.isDone ? 'text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {step.label}
                          </p>
                          {step.date && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {dateTime(step.date)}
                            </p>
                          )}
                          {step.description && (
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {step.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detail Cards Grid */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {/* Customer & Address */}
              <div className="rounded-xl border border-border p-4 text-xs space-y-2">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  بيانات العميل والتسليم
                </p>
                <div className="space-y-1">
                  <p className="font-semibold text-foreground text-sm">{selectedShipment.receiver.name}</p>
                  <p className="font-mono text-muted-foreground">{selectedShipment.receiver.phone}</p>
                  <p className="text-foreground">
                    {[
                      selectedShipment.destination.city,
                      selectedShipment.destination.zone,
                      selectedShipment.destination.district,
                    ]
                      .filter(Boolean)
                      .join(' - ')}
                  </p>
                  {selectedShipment.destination.address && (
                    <p className="text-muted-foreground">{selectedShipment.destination.address}</p>
                  )}
                </div>
              </div>

              {/* Operations & Cash Collection */}
              <div className="rounded-xl border border-border p-4 text-xs space-y-2">
                <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  تفاصيل العملية والتحصيل
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مبلغ التحصيل (COD):</span>
                    <span className="font-semibold text-foreground">
                      {money(selectedShipment.cod?.amount ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">حالة المبلغ المحصل:</span>
                    <span
                      className={cn(
                        'font-semibold',
                        selectedShipment.cod?.collectionStatus === 'PAID' && 'text-success',
                        selectedShipment.cod?.collectionStatus === 'UNPAID' && 'text-destructive',
                        (!selectedShipment.cod?.collectionStatus ||
                          selectedShipment.cod.collectionStatus === 'PENDING') &&
                          'text-muted-foreground',
                      )}
                    >
                      {selectedShipment.cod?.collectionStatusLabel ?? 'قيد التحصيل'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تطبيق فليكس شيب:</span>
                    <span className="font-medium text-foreground">
                      {selectedShipment.flexShipFee ? money(selectedShipment.flexShipFee) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">محاولات التوصيل:</span>
                    <span className="font-mono font-medium text-foreground">
                      {selectedShipment.attempts.count} من أصل {selectedShipment.attempts.max} محاولات
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">السماح للعميل بفتح الشحنة؟</span>
                    <span className="font-medium text-foreground">
                      {selectedShipment.allowOpenPackage ? 'نعم (Yes)' : 'لا'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedShipment(null)}
                className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-xs font-medium text-background hover:opacity-90"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
