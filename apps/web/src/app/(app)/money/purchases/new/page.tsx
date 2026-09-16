import { InvoiceBuilder } from '@/components/invoice-builder';
import { getMoneyAccounts, getSuppliers } from '@/lib/api';
import { accountByCode } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

export default async function NewPurchasePage() {
  await requireAdmin();
  const [suppliers, accounts] = await Promise.all([getSuppliers(), getMoneyAccounts()]);
  return <InvoiceBuilder suppliers={suppliers} cashBalance={accountByCode(accounts, 'CASH')?.balance ?? '0'} />;
}
