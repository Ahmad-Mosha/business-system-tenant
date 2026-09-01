import Link from 'next/link';
import { InvoiceBuilder } from '@/components/invoice-builder';
import { ContextBar, Screen } from '@/components/shell';
import { getMoneyAccounts, getSuppliers } from '@/lib/api';
import { accountByCode } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

export default async function NewPurchasePage() {
  await requireAdmin();
  const [suppliers, accounts] = await Promise.all([getSuppliers(), getMoneyAccounts()]);

  if (suppliers.length === 0) {
    return (
      <Screen>
        <ContextBar back="/money/purchases" title="New purchase invoice" />
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <h1 className="text-lg font-semibold">Add a supplier first</h1>
          <p className="text-sm text-muted-foreground">A purchase invoice needs a supplier to buy from.</p>
          <Link
            href="/money/suppliers"
            className="inline-flex h-9 items-center rounded-md bg-foreground px-4 text-[13px] font-medium text-background"
          >
            Go to Suppliers
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <InvoiceBuilder
      suppliers={suppliers}
      cashBalance={accountByCode(accounts, 'CASH')?.balance ?? '0'}
    />
  );
}
