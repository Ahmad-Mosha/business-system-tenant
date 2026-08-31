import { cn } from '@/lib/cn';
import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';

export function Table({ children }: { children: ReactNode }) {
  return (
    // Wide tables scroll inside their own region; the page never moves sideways.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-data">{children}</table>
    </div>
  );
}

export function Th({
  numeric,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      {...props}
      className={cn(
        'label-caps sticky top-0 z-10 h-8 border-b border-line bg-surface px-3 whitespace-nowrap',
        numeric ? 'text-right' : 'text-left',
        className,
      )}
    />
  );
}

export function Td({
  numeric,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      {...props}
      className={cn('h-(--spacing-row) px-3', numeric && 'figure tabular-nums', className)}
    />
  );
}

/** A row that can be selected. Selection lives in the URL, so it is linkable. */
export function Tr({
  selected,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { selected?: boolean }) {
  return (
    <tr
      {...props}
      aria-selected={selected}
      className={cn(
        'border-b border-line/70 transition-colors last:border-b-0',
        selected ? 'bg-accent-soft' : 'hover:bg-raised',
        className,
      )}
    />
  );
}
