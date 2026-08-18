import type { ReactNode } from 'react';
import { requireUser } from '@/lib/session';
import { ShellFrame } from '@/components/shell-frame';

/**
 * Everything below requires a session. The check runs on the server before any page
 * renders, so protected content never reaches an anonymous browser.
 */
export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <ShellFrame user={user}>{children}</ShellFrame>;
}
