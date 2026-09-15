import { Users } from 'lucide-react';
import Link from 'next/link';
import { InvoiceBuilder } from '@/components/invoice-builder';
import { Page, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { getMoneyAccounts, getSuppliers } from '@/lib/api';
import { accountByCode } from '@/lib/money';
import { requireAdmin } from '@/lib/session';
import { getTranslations } from 'next-intl/server';

export default async function NewPurchasePage() {
  await requireAdmin();
  const t = await getTranslations('money');
  const [suppliers, accounts] = await Promise.all([getSuppliers(), getMoneyAccounts()]);

  if (suppliers.length === 0) {
    return (
      <Page width="narrow">
        <PageHeader
          back={{ href: '/money/purchases', label: t('invoice.back') }}
          title={t('newInvoice.title')}
        />
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{t('newInvoice.supplierFirst')}</EmptyTitle>
            <EmptyDescription>{t('newInvoice.supplierFirstHint')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/money/suppliers">{t('newInvoice.goToSuppliers')}</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </Page>
    );
  }

  return (
    <InvoiceBuilder suppliers={suppliers} cashBalance={accountByCode(accounts, 'CASH')?.balance ?? '0'} />
  );
}
