import { cn } from '@/lib/cn';

/** Initials rather than photos: there are no avatar images in this system. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full',
        'bg-mute-bg text-[10px] font-semibold text-mute',
        className,
      )}
    >
      {initials || '?'}
    </span>
  );
}
