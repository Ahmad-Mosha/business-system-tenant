import { notFound, redirect } from 'next/navigation';
import { InvoiceBuilder } from '@/components/money/invoice-builder';
import { getMoneyAccounts, getPurchase, getSuppliers } from '@/lib/api';
import { accountByCode } from '@/lib/money';
import { requireAdmin } from '@/lib/session';

/** A draft reopened in the invoice builder. A posted invoice is read-only. */
export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const invoice = await getPurchase(id).catch(() => null);
  if (!invoice) notFound();
  if (invoice.status !== 'DRAFT') redirect(`/money/purchases/${id}`);
  const [suppliers, accounts] = await Promise.all([getSuppliers(), getMoneyAccounts()]);
  return (
    <InvoiceBuilder
      invoice={invoice}
      suppliers={suppliers}
      cashBalance={accountByCode(accounts, 'CASH')?.balance ?? '0'}
      draftKey={`${user.id}:purchase:${id}`}
    />
  );
}
