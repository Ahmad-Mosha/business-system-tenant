import { notFound } from 'next/navigation';
import { ProductScreen } from '@/components/product-screen';
import { getProductDetail, getStockHistory } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const product = await getProductDetail(id).catch(() => null);
  if (!product) notFound();

  // One product usually has one variant, so this is one extra query, not N.
  const history = await Promise.all(
    product.variants.map(async (v) => ({ variantId: v.id, movements: await getStockHistory(v.id) })),
  );

  return <ProductScreen product={product} history={history} />;
}
