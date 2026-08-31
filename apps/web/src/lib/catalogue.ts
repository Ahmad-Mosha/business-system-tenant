import { api } from './api';

export type Category = 'COSMETICS' | 'HOME' | 'ELECTRONICS' | 'TV_SHOP';

/** Both languages: the business speaks Arabic, the interface labels are English. */
export const CATEGORY_LABELS: Record<Category, { en: string; ar: string }> = {
  COSMETICS: { en: 'Cosmetics', ar: 'مستحضرات تجميل' },
  HOME: { en: 'Home', ar: 'منزلي' },
  ELECTRONICS: { en: 'Electronics', ar: 'إلكترونيات' },
  TV_SHOP: { en: 'TV Shop', ar: 'تي في شوب' },
};

export interface Product {
  id: string;
  name: string;
  category: Category;
  notes: string | null;
  active: boolean;
  variantCount: number;
  listingCount: number;
}

export interface Listing {
  id: string;
  channel: 'NOON' | 'AMAZON' | 'EASYORDERS' | 'SOCIAL';
  externalId: string;
  externalVariantId: string;
  label: string | null;
}

export interface Variant {
  id: string;
  attributes: Record<string, string>;
  code: string | null;
  active: boolean;
  listings: Listing[];
}

export interface ProductDetail extends Product {
  variants: Variant[];
}

export interface ProductPage {
  items: Product[];
  total: number;
  limit: number;
  offset: number;
}

export function listProducts(params: { search?: string; category?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.category) q.set('category', params.category);
  q.set('limit', String(params.limit ?? 200));
  return api<ProductPage>(`/products?${q}`);
}

export const getProduct = (id: string) => api<ProductDetail>(`/products/${id}`);

export interface Summary {
  byCategory: Partial<Record<Category, number>>;
  products: number;
  listings: number;
  /** Products that no arriving sale could attach to yet. */
  unmapped: number;
}

export const summary = () => api<Summary>('/products/summary');
