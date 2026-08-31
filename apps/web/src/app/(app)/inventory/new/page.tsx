import { NewProductForm } from '@/components/new-product-form';
import { requireAdmin } from '@/lib/session';

export default async function NewProductPage() {
  await requireAdmin();
  return <NewProductForm />;
}
