'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode } from 'react';
import { ProblemNotice } from '@/components/problem-notice';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { VariantSearch, type VariantHit } from '@/components/variant-search';
import type { Problem } from '@/lib/problem';

type Result = { ok: true } | { ok: false; message: string; problem?: Problem } | void;

/**
 * "Move this to…" for the catalogue: find the other product by name or SKU,
 * see it named, then confirm. Moving a channel SKU and merging a duplicate
 * both start here. A refusal shows in place, with what's in the way.
 */
export function PickProductDialog({
  trigger,
  title,
  description,
  confirmLabel,
  exclude,
  onConfirm,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  /** Variants that can't be the target — the product being changed. */
  exclude: string[];
  onConfirm: (target: VariantHit) => Promise<Result>;
}) {
  const t = useTranslations('product.pick');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<VariantHit | null>(null);
  const [refusal, setRefusal] = useState<{ message: string; problem?: Problem } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setTarget(null);
          setRefusal(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <VariantSearch
            onPick={(hit) => {
              setTarget(hit);
              setRefusal(null);
            }}
            disabledReason={(hit) => (exclude.includes(hit.id) ? t('thisOne') : null)}
            meta={(hit) => t('onHand', { count: hit.onHand })}
            placeholder={t('search')}
            disabled={pending}
          />
          {target ? (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {t('chosen')} <bdi className="font-medium">{target.label}</bdi>
            </p>
          ) : null}
        </div>
        {refusal ? <ProblemNotice problem={refusal.problem} message={refusal.message} /> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={pending}>{tc('cancel')}</Button>
          </DialogClose>
          <Button
            disabled={!target || pending}
            onClick={() =>
              start(async () => {
                if (!target) return;
                setRefusal(null);
                const r = await onConfirm(target);
                if (r && !r.ok) return void setRefusal({ message: r.message, problem: r.problem });
                setOpen(false);
              })
            }
          >
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
