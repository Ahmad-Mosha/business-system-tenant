'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { toast } from 'sonner';
import { settleCheque, type FormState } from '@/app/(app)/money/actions';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import type { ChequeRow } from '@/lib/api';
import { money } from '@/lib/format';
import { useFormat } from '@/i18n/use-format';

/** Cheques received but not cleared — clear or bounce each one. */
export function PendingCheques({ cheques }: { cheques: ChequeRow[] }) {
  const t = useTranslations('money');
  const f = useFormat();
  if (cheques.length === 0) return null;
  const total = cheques.reduce((n, c) => n + Number(c.amount), 0);
  return (
    <Card className="shrink-0 pb-0">
      <CardHeader>
        <CardTitle>{t('treasury.chequesPending')}</CardTitle>
        <CardDescription>{t('cheques.hint')}</CardDescription>
        <CardAction className="num text-sm font-semibold">{money(total)}</CardAction>
      </CardHeader>
      <div className="border-t">
        <Table>
          <TableBody>
            {cheques.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="num w-[140px] text-end font-medium">{money(c.amount)}</TableCell>
                <TableCell className="max-w-0 truncate">
                  <bdi>{c.fromParty}</bdi>
                  {c.memo ? (
                    <span className="text-muted-foreground">
                      {' · '}
                      <bdi>{c.memo}</bdi>
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="w-[160px] text-muted-foreground">
                  {c.dueDate
                    ? t('cheques.due', { date: f.date(c.dueDate) })
                    : t('cheques.received', { date: f.date(c.receivedDate) })}
                </TableCell>
                <TableCell className="w-[190px] text-end">
                  <ChequeActions id={c.id} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function ChequeActions({ id }: { id: string }) {
  const t = useTranslations('money.cheques');
  const [, submit, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const next = await settleCheque(prev, form);
    if (next.status === 'error') toast.error(next.message);
    if (next.status === 'saved') toast.success(t('updated'));
    return next;
  }, { status: 'idle' });

  return (
    <form action={submit} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="status" value="BOUNCED" size="sm" variant="ghost" disabled={pending} className="text-muted-foreground">
        {t('bounced')}
      </Button>
      <Button type="submit" name="status" value="CLEARED" size="sm" variant="outline" disabled={pending}>
        {pending ? <Spinner /> : null}
        {t('cleared')}
      </Button>
    </form>
  );
}
