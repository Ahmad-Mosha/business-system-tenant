import { ArrowUpLeft, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Children, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './list-page.module.css';

/** The headline figures above a list, in one strip. */
export function SummaryStrip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section
      aria-label={label}
      className={styles.summary}
      style={{ '--metrics': Children.toArray(children).length } as React.CSSProperties}
    >
      {children}
    </section>
  );
}

/**
 * One figure: what it is, how much, and a line of context. With `href` it
 * opens the records behind it — the list, filtered to them.
 */
export function SummaryMetric({
  label,
  icon: Icon,
  value,
  hint,
  href,
  attention = false,
  hintAttention = attention,
  sensitive = false,
}: {
  label: string;
  icon: LucideIcon;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  /** Something here needs someone — the icon turns amber. */
  attention?: boolean;
  hintAttention?: boolean;
  /** Hidden by the privacy switch. */
  sensitive?: boolean;
}) {
  const body = (
    <>
      <p className={styles.metricLabel}>{label}<Icon aria-hidden className={attention ? styles.warning : undefined} /></p>
      <p className={cn('num', styles.metricValue)} data-sensitive={sensitive || undefined}>{value}</p>
      {hint ? (
        <p className={cn(styles.metricHint, hintAttention && styles.warning)}>
          {hint}
          {href ? <ArrowUpLeft aria-hidden className="ltr:-scale-x-100" /> : null}
        </p>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className={cn(styles.metric, styles.metricLink)}>{body}</Link>
  ) : (
    <div className={styles.metric}>{body}</div>
  );
}

/** A list's title with how many records it holds. */
export function ListTitle({ title, count }: { title: ReactNode; count: ReactNode }) {
  return <h2 className={styles.listTitle}>{title}<span className={cn('num', styles.listCount)}>{count}</span></h2>;
}

/** Quick views of a list, each with its count — links, so the view lives in the URL. */
export function QuickViews({
  label,
  views,
}: {
  label: string;
  views: Array<{ key: string; label: ReactNode; count: ReactNode; href: string; current: boolean }>;
}) {
  return (
    <nav aria-label={label} className={styles.views}>
      {views.map((v) => (
        <Link key={v.key} href={v.href} aria-current={v.current ? 'page' : undefined} className={styles.view}>
          {v.label}<span className={cn('num', styles.viewCount)}>{v.count}</span>
        </Link>
      ))}
    </nav>
  );
}
