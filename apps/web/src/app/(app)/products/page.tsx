import Link from 'next/link';
import { ProductDetail } from '@/components/products/detail';
import { ProductsToolbar } from '@/components/products/toolbar';
import { Topbar } from '@/components/topbar';
import { Empty } from '@/components/ui/empty';
import { Table, Td, Th, Tr } from '@/components/ui/table';
import { CATEGORY_LABELS, getProduct, listProducts, summary } from '@/lib/catalogue';
import { getSession } from '@/lib/session';

interface SearchParams {
  search?: string;
  category?: string;
  id?: string;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (!session) return null;

  // The list and the open row are fetched together; the row is in the URL, so
  // a selected product survives a reload and can be sent to someone.
  const [page, counts, selected] = await Promise.all([
    listProducts(params),
    summary(),
    params.id ? getProduct(params.id).catch(() => null) : null,
  ]);

  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  const base = `/products${query.size ? `?${query}` : ''}`;
  const href = (id: string) => {
    const q = new URLSearchParams(query);
    q.set('id', id);
    return `/products?${q}`;
  };

  return (
    <>
      <Topbar session={session} title="Products" />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <ProductsToolbar total={page.total} unmapped={counts.unmapped} />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {page.items.length === 0 ? (
              <Empty
                title="No products match"
                detail="Clear the search or pick a different category. The catalogue holds 135 products seeded from the legacy system."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>Category</Th>
                    <Th numeric>Variants</Th>
                    <Th>Channels</Th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((p) => (
                    <Tr key={p.id} selected={p.id === params.id}>
                      <Td className="max-w-0">
                        {/*
                          dir=auto orders Arabic correctly inside the cell;
                          text-left keeps the column scannable from one edge.
                        */}
                        <Link
                          href={href(p.id)}
                          scroll={false}
                          dir="auto"
                          className="block truncate text-left font-medium text-ink hover:text-accent"
                        >
                          {p.name}
                        </Link>
                      </Td>
                      <Td className="text-ink-soft whitespace-nowrap">
                        {CATEGORY_LABELS[p.category].en}
                      </Td>
                      <Td numeric className="text-ink-soft">
                        {p.variantCount}
                      </Td>
                      <Td>
                        {p.listingCount === 0 ? (
                          <span className="text-ink-faint">—</span>
                        ) : (
                          <span className="text-ink-soft">{p.listingCount}</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>

        {selected && <ProductDetail product={selected} closeHref={base} />}
      </div>
    </>
  );
}
