import { NewProductForm } from '@/components/inventory/new-product-form';
import { requireAdmin } from '@/lib/session';

export default async function NewProductPage() {
  const user = await requireAdmin();
  return <NewProductForm draftKey={`${user.id}:product:new`} />;
}
