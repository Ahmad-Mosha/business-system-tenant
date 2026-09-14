'use client';

import { RefreshCw } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { syncEasyOrders } from '@/app/(app)/inventory/actions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Pulls the live Easy Orders catalogue so website orders resolve to stock. */
export function SyncWebsiteButton() {
  const [syncing, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={syncing}
      onClick={() =>
        start(async () => {
          const r = await syncEasyOrders();
          if (r.ok)
            toast.success(`Website catalogue synced: ${r.updated} updated, ${r.unmatched.length} unmatched.`);
          else toast.error(r.message);
        })
      }
    >
      <RefreshCw className={cn(syncing && 'animate-spin')} />
      Sync website
    </Button>
  );
}
