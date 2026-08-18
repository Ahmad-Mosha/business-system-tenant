import { PERMISSIONS, type AssignableUser, type ListVariantsResponse } from '@app/contracts';
import { redirect } from 'next/navigation';
import { CreateOrderForm } from '@/components/create-order-form';
import { apiGet } from '@/lib/api';
import { can } from '@/lib/permissions';
import { requireUser } from '@/lib/session';

export const metadata = { title: 'New order' };

export default async function NewOrderPage() {
  const user = await requireUser();
  if (!can(user, PERMISSIONS.ORDER_CREATE)) redirect('/orders');

  const canAssign = can(user, PERMISSIONS.ORDER_ASSIGN);
  const [catalog, assignable] = await Promise.all([
    apiGet<ListVariantsResponse>('/catalog/variants?limit=100'),
    canAssign ? apiGet<AssignableUser[]>('/orders/assignable-users') : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <header className="mb-6">
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">New order</h1>
        <p className="mt-1 text-[14px] text-ink-2">
          For orders taken over the phone or from social media.
        </p>
      </header>
      <CreateOrderForm
        variants={catalog.items}
        assignableUsers={assignable}
        canAssign={canAssign}
      />
    </div>
  );
}
