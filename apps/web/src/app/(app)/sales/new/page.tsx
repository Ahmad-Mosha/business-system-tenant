import { SalesInvoiceBuilder } from '@/components/sales-invoice-builder';
import { getCustomers } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export default async function NewSalesInvoicePage() {
  const user = await requireAdmin();
  const customers = await getCustomers();
  return <SalesInvoiceBuilder customers={customers} draftKey={`${user.id}:sale:new`} />;
}
