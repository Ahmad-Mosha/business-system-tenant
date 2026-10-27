import { SalesInvoiceBuilder } from '@/components/sales/sales-invoice-builder';
import { getCustomers } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export default async function NewSalesInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const user = await requireAdmin();
  const [customers, { customer }] = await Promise.all([getCustomers(), searchParams]);
  // Opened from a customer's page: start with them chosen.
  const chosen = customers.some((c) => c.id === customer) ? customer : undefined;
  return <SalesInvoiceBuilder customers={customers} customerId={chosen} draftKey={`${user.id}:sale:new`} />;
}
