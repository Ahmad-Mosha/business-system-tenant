import type { ReactNode } from 'react';

/**
 * The single page-title treatment. Every screen uses this so the eye lands in
 * the same place on every navigation.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-6 lg:px-10 lg:py-8">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Standard page body padding, so gutters never drift between screens. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="space-y-10 px-6 py-8 lg:px-10">{children}</div>;
}

export function SectionHeading({
  title,
  hint,
}: {
  title: string;
  hint?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-sm font-medium tracking-[-0.01em]">{title}</h2>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
