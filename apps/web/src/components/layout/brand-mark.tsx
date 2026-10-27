import { cn } from '@/lib/utils';

/** The product mark: the monogram on a plain teal square. Sized by `className` (default 32px). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-[15px] font-bold text-primary-foreground',
        className,
      )}
    >
      {/* The monogram is part of the logo, not words to translate. */}
      {'P'}
    </span>
  );
}
