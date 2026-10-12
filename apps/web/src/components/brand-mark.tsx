import { cn } from '@/lib/utils';

/**
 * The product mark: a teal key with a light from above — the same physical
 * cue as the primary button, so brand and action read as one family. Sized by
 * `className` (default 32px).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[linear-gradient(160deg,oklch(0.6_0.11_184),oklch(0.46_0.09_190))] font-heading text-[15px] font-bold text-white shadow-xs ring-1 ring-black/10 inset-shadow-[0_1px_0_0_rgb(255_255_255/0.25)]',
        className,
      )}
    >
      {/* The monogram is part of the logo, not words to translate. */}
      {'P'}
    </span>
  );
}
