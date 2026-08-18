'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from './ui/button';

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    startTransition(() => {
      router.replace('/login');
      router.refresh();
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut} disabled={pending}>
      {pending ? 'Signing out' : 'Sign out'}
    </Button>
  );
}
