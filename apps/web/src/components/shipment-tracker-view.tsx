'use client';

import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  MapPin,
  MessageSquare,
  Package,
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

export function ShipmentTrackerView({
  initialTrackingNumber = '',
}: {
  initialTrackingNumber?: string;
}) {
  const [searchTerm, setSearchTerm] = useState(initialTrackingNumber);
  const [tracking, setTracking] = useState<ShipmentTracking | null>(null);
  const [lastSearched, setLastSearched] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleTrack = (tn: string) => {
    const clean = tn.trim();
    if (!clean) return;

    startTransition(async () => {
      const res = await trackBostaLive(clean);
      if (res.ok) {
        setTracking(res.data);
        setLastSearched(clean);
        toast.success(`Fetched tracking for #${clean}`);
      } else {
        toast.error(res.message);
        setTracking(null);
        setLastSearched(clean);
      }
    });
  };

  const copyTracking = (tn: string) => {
    navigator.clipboard.writeText(tn);
    toast.success('Tracking number copied');
  };

  const quickNumbers = ['8755006904', '4476601903', '7377316933'];

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Live Bosta Tracking Lookup
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Check the live delivery status, timeline checkpoints, and COD collection for any Bosta tracking number.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleTrack(searchTerm);
          }}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Enter Bosta tracking number (e.g. 8755006904)..."
              disabled={pending}
              className="h-10 w-full rounded-md border border-border bg-background pr-8 pl-9 text-sm tabular-nums placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={pending || !searchTerm.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
            Track Live
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Quick test numbers:</span>
          {quickNumbers.map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => {
                setSearchTerm(num);
                handleTrack(num);
              }}
              className="rounded border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] hover:bg-accent hover:text-foreground"
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Live Result */}
      {tracking && (
        <div className="overflow-hidden rounded-xl border border-border bg-card animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
                <Truck className="size-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Bosta Shipment
                  </span>
                  <span className="font-mono text-base font-semibold tracking-tight text-foreground">
                    #{tracking.trackingNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyTracking(tracking.trackingNumber)}
                    className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </div>
                {tracking.receiver?.name && (
                  <p className="text-xs text-muted-foreground">
                    Customer: {tracking.receiver.name} ({tracking.receiver.phone})
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                  tracking.status === 'DELIVERED'
                    ? 'border-success/30 bg-success-subtle text-success'
                    : tracking.isDelayed
                      ? 'border-warning/30 bg-warning-subtle text-warning'
                      : 'border-border bg-muted text-foreground',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    tracking.status === 'DELIVERED' ? 'bg-success' : 'bg-foreground/60',
                  )}
                />
                {tracking.statusLabel}
              </span>

              <button
                type="button"
                disabled={pending}
                onClick={() => handleTrack(tracking.trackingNumber)}
                title="Refresh"
                className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <RefreshCw className={cn('size-3.5', pending && 'animate-spin')} />
              </button>

              <a
                href={`https://bosta.co/tracking?trackingNumber=${tracking.trackingNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>

          {/* Delayed Banner */}
          {tracking.isDelayed && (
            <div className="flex items-center gap-2 border-b border-warning/30 bg-warning-subtle px-5 py-2.5 text-xs text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              <span>This delivery is flagged as delayed by Bosta.</span>
            </div>
          )}

          {/* Timeline Stepper */}
          {tracking.timeline && tracking.timeline.length > 0 && (
            <div className="border-b border-border p-5">
              <p className="mb-4 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Delivery Timeline
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {tracking.timeline.map((step, idx) => {
                  const isLast = idx === tracking.timeline.length - 1;
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
                          {step.isDone ? <Check className="size-3.5" strokeWidth={2.5} /> : idx + 1}
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
                          <p className="mt-0.5 text-[11px] text-muted-foreground font-mono">
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

          {/* Metrics Grid */}
          <div className="grid divide-y divide-border text-xs sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
            <div className="space-y-1.5 p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                COD Collection
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {money(tracking.cod?.amount ?? 0)}
                </span>
                {tracking.cod?.isCollected ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-success">
                    <CheckCircle2 className="size-3" /> Collected
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Pending</span>
                )}
              </div>
              {tracking.flexShipFee ? (
                <p className="text-[11px] text-muted-foreground">
                  FlexShip fee: {money(tracking.flexShipFee)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5 p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Delivery Attempts
              </p>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tabular-nums text-foreground">
                  {tracking.attempts?.count ?? 1} / {tracking.attempts?.max ?? 3}
                </span>
                <span className="text-[11px] text-muted-foreground">attempts</span>
              </div>
              {tracking.allowOpenPackage && (
                <p className="text-[11px] text-muted-foreground">
                  ✓ Open package allowed
                </p>
              )}
            </div>

            <div className="space-y-1.5 p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                WhatsApp Confirmation
              </p>
              {tracking.whatsAppConfirmation?.isConfirmed ? (
                <div className="flex items-center gap-1.5 text-success">
                  <MessageSquare className="size-3.5 shrink-0" />
                  <span className="font-medium">Confirmed via WhatsApp</span>
                </div>
              ) : (
                <p className="text-muted-foreground">Direct phone verification</p>
              )}
              {tracking.packageSpecs?.description && (
                <p className="truncate text-muted-foreground">{tracking.packageSpecs.description}</p>
              )}
            </div>

            <div className="space-y-1.5 p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Destination
              </p>
              <div className="flex items-center gap-1.5 truncate text-foreground font-medium">
                <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {[tracking.destination?.city, tracking.destination?.zone, tracking.destination?.district]
                    .filter(Boolean)
                    .join(' · ') || 'Egypt'}
                </span>
              </div>
              {tracking.destination?.address && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {tracking.destination.address}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {lastSearched && !tracking && !pending && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
          No shipment found for tracking number <strong className="font-mono text-foreground">{lastSearched}</strong>. Verify the number or check Bosta portal.
        </div>
      )}
    </div>
  );
}
