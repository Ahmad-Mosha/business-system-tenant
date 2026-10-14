/**
 * Why the system refused something, as the API explains it (apps/api/src/problem.ts):
 * a code the messages word (`errors.api.<code>`), the values its sentence needs,
 * the records in the way, and — when several things block one action — each
 * reason on its own. Screens render it with <ProblemNotice>.
 */
export interface Blocker {
  kind: string;
  id?: string;
  label?: string;
  amount?: string;
  date?: string;
  count?: number;
  detail?: string;
  parentId?: string;
}

export interface Reason {
  code: string;
  params?: Record<string, string | number>;
  blockers?: Blocker[];
}

export interface Problem extends Reason {
  reasons?: Reason[];
}

/** Where a blocking record is opened. */
export function blockerHref(b: Blocker): string | null {
  switch (b.kind) {
    case 'order':
      return b.id ? `/orders/${b.id}` : null;
    case 'purchase_invoice':
      return b.id ? `/money/purchases/${b.id}` : null;
    case 'sales_invoice':
      return b.id ? `/sales/${b.id}` : null;
    case 'supplier':
      return b.id ? `/money/suppliers/${b.id}` : null;
    case 'supplier_payment':
      return b.parentId ? `/money/suppliers/${b.parentId}` : null;
    case 'customer':
      return b.id ? `/customers/${b.id}` : null;
    case 'customer_payment':
      return b.parentId ? `/sales/${b.parentId}` : null;
    case 'product':
      return b.id ? `/inventory/${b.id}` : null;
    case 'listing':
    case 'stock':
    case 'stock_movement':
      return b.parentId ? `/inventory/${b.parentId}` : null;
    default:
      return null;
  }
}

/** A pre-check from a detail screen as a problem to show: the headline plus what's in the way. */
export const blockedBy = (code: string, reasons: Reason[] | undefined): Problem | null =>
  reasons?.length ? { code, reasons } : null;
