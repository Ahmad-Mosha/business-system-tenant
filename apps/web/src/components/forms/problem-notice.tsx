'use client';

import { AlertTriangle, ArrowUpRight, CircleSlash } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useFormat } from '@/i18n/use-format';
import { money } from '@/lib/format';
import { blockerHref, type Blocker, type Problem } from '@/lib/problem';
import { cn } from '@/lib/utils';

/**
 * Why something can't be done, said so a person can act on it: the rule in
 * plain words, every record in the way — named, with its amount or date, and
 * a link to open it — and what to do next (the message's own last sentence).
 * Without a `problem` it shows `message`: a failure, not a rule.
 */
export function ProblemNotice({ problem, message, className }: { problem?: Problem | null; message?: string; className?: string }) {
  const t = useTranslations('errors');
  const say = (code: string, params?: Record<string, string | number>) => {
    const key = `api.${code}` as Parameters<typeof t>[0];
    return t.has(key) ? t(key, params ?? {}) : null;
  };
  if (!problem) {
    return message ? (
      <Alert variant="destructive" className={className}>
        <AlertTriangle />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    ) : null;
  }
  const reasons = problem.reasons ?? [problem];
  const headline = problem.reasons ? say(problem.code, problem.params) : null;
  // A restriction that can't be lifted says what to do instead: `<code>Next`.
  const next = say(`${problem.code}Next`, problem.params);
  return (
    <Alert variant="warning" className={className} role="alert">
      <CircleSlash />
      <AlertDescription className="grid gap-2.5 text-foreground/90">
        {headline ? <p className="font-medium text-foreground">{headline}</p> : null}
        {reasons.map((r, i) => (
          <div key={`${r.code}-${i}`} className="grid gap-1.5">
            <p>{say(r.code, r.params) ?? message}</p>
            {r.blockers?.length ? <BlockerList blockers={r.blockers} /> : null}
          </div>
        ))}
        {next ? (
          <div className="border-t border-warning/20 pt-2.5">
            <p className="text-xs font-medium text-muted-foreground">{t('blockers.next')}</p>
            <p className="mt-0.5">{next}</p>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/** The records in the way, each named the way the business knows it and opened in one click. */
function BlockerList({ blockers }: { blockers: Blocker[] }) {
  const t = useTranslations('errors.blockers');
  const f = useFormat();
  // Kinds and details are open sets from the API: looked up loosely, shown raw if unknown.
  const loose = t as unknown as { has: (key: string) => boolean; (key: string): string };
  const has = (key: string) => loose.has(key);
  const say = (key: string) => loose(key);
  return (
    <ul className="grid gap-1">
      {blockers.map((b, i) => {
        const href = blockerHref(b);
        const name = (
          <>
            <span className="text-muted-foreground">{has(`kind.${b.kind}`) ? say(`kind.${b.kind}`) : b.kind}</span>{' '}
            {b.label ? <bdi className="font-medium">{b.label}</bdi> : null}
          </>
        );
        const facts = [
          b.detail && has(`detail.${b.detail}`) ? say(`detail.${b.detail}`) : null,
          b.count !== undefined ? t('units', { count: b.count }) : null,
          b.amount ? money(b.amount) : null,
          b.date ? f.date(b.date) : null,
        ].filter(Boolean);
        return (
          <li key={`${b.kind}-${b.id ?? i}`} className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13px]">
            {href ? (
              <Link href={href} className={cn('inline-flex items-baseline gap-1 underline-offset-2 hover:underline')}>
                {name}
                <ArrowUpRight className="size-3 self-center rtl:-scale-x-100" />
              </Link>
            ) : (
              <span>{name}</span>
            )}
            {facts.length ? <span className="num text-xs text-muted-foreground">{facts.join(' · ')}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
