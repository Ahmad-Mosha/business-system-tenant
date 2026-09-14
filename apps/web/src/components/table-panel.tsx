import type { LucideIcon } from 'lucide-react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

/**
 * A table on a card. On a `fill` page it shrinks to the space left and scrolls
 * inside — header pinned, footer pinned — and grows no taller than its rows,
 * so a short list doesn't leave a tall empty card.
 *
 * It un-scrolls the table's own wrapper, so this panel is the scroll container
 * and the sticky header actually sticks.
 */
export function TablePanel({
  children,
  footer,
  toolbar,
  minWidth = '42rem',
  className,
}: {
  children: ReactNode;
  footer?: ReactNode;
  /** A strip above the table, inside the card — a title or tabs. */
  toolbar?: ReactNode;
  /** Narrower than this, the table scrolls sideways instead of crushing its columns. */
  minWidth?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden bg-card text-card-foreground ring-1 ring-foreground/10 lg:min-h-0',
        className,
      )}
    >
      {toolbar ? <div className="shrink-0 border-b">{toolbar}</div> : null}
      <div
        style={{ '--table-min': minWidth } as React.CSSProperties}
        className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible [&_table]:min-w-(--table-min) [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10"
      >
        {children}
      </div>
      {footer ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-4 py-2">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

/** The footer's left half: what you're looking at. */
export function TableCount({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

/** Pages to show: first, last, and a window around the current one. */
function pageList(page: number, last: number): Array<number | '…'> {
  const pages = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

/**
 * "Showing 21–40 of 312 orders" and the page links. Links, not buttons — the
 * page lives in the URL with the filters, so paging never resets a view.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  count,
  noun,
  href,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Rows on this page. */
  count: number;
  noun: string;
  href: (page: number) => string;
}) {
  const last = Math.max(Math.ceil(total / pageSize), 1);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + count;

  return (
    <>
      <TableCount>
        {total === 0 ? (
          `No ${noun}`
        ) : (
          <>
            Showing{' '}
            <span className="num font-medium text-foreground">
              {from}–{to}
            </span>{' '}
            of <span className="num font-medium text-foreground">{total}</span> {noun}
          </>
        )}
      </TableCount>
      {last > 1 ? (
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              {page > 1 ? (
                <PaginationPrevious href={href(page - 1)} />
              ) : (
                <Button variant="ghost" disabled className="pl-1.5!">
                  <ChevronLeftIcon data-icon="inline-start" />
                  <span className="hidden sm:block">Previous</span>
                </Button>
              )}
            </PaginationItem>
            {pageList(page, last).map((p, i) =>
              p === '…' ? (
                <PaginationItem key={`gap-${i}`} className="hidden sm:block">
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p} className={cn(p !== page && 'hidden sm:block')}>
                  <PaginationLink href={href(p)} isActive={p === page} className="num">
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              {page < last ? (
                <PaginationNext href={href(page + 1)} />
              ) : (
                <Button variant="ghost" disabled className="pr-1.5!">
                  <span className="hidden sm:block">Next</span>
                  <ChevronRightIcon data-icon="inline-end" />
                </Button>
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </>
  );
}

/** What an empty table says instead — why it's empty, and the way forward. */
export function TableEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Empty className="py-14">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}
