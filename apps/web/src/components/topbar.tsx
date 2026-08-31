import { logout } from '@/app/login/actions';
import { Button } from '@/components/ui/button';
import type { Session } from '@/lib/session';

export function Topbar({ session, title }: { session: Session; title: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-4">
      <h1 className="text-[13px] font-semibold text-ink">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <p className="text-xs font-medium text-ink">{session.email}</p>
          <p className="label-caps">{session.role}</p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="ghost" compact>
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
