import { notFound, redirect } from 'next/navigation';
import { SalesInvoiceBuilder } from '@/components/sales/sales-invoice-builder';
import { getCustomers, getSalesInvoice } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

/** A draft reopened in the builder. A posted invoice is read-only. */
export default async function EditSalesInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const invoice = await getSalesInvoice(id).catch(() => null);
  if (!invoice) notFound();
  if (invoice.status !== 'DRAFT') redirect(`/sales/${id}`);
  const customers = await getCustomers();
  return <SalesInvoiceBuilder invoice={invoice} customers={customers} draftKey={`${user.id}:sale:${id}`} />;
}
