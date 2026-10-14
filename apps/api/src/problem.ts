import { BadRequestException } from '@nestjs/common';

/**
 * A record that stands in the way of an action, for the web to name and link:
 * `kind` picks the screen, `id` the record, `label` is how a person knows it
 * (PM-1022, SI-1001, an invoice number, a product name).
 */
export interface Blocker {
  kind:
    | 'order'
    | 'purchase_invoice'
    | 'sales_invoice'
    | 'supplier'
    | 'supplier_payment'
    | 'customer'
    | 'customer_payment'
    | 'product'
    | 'listing'
    | 'stock'
    | 'stock_movement';
  id?: string;
  label?: string;
  amount?: string;
  /** ISO date or time the record happened. */
  date?: string;
  count?: number;
  /** A short code for what the record is or did — `SALE`, `PENDING`, a channel — worded by the web. */
  detail?: string;
  /** For links that need a parent: a payment's supplier, a listing's product. */
  parentId?: string;
}

/** One reason an action is refused: a code the web words, its values, and the records involved. */
export interface Reason {
  code: string;
  params?: Record<string, string | number>;
  blockers?: Blocker[];
}

/**
 * The body of an error a person will read. `code` is stable — the web app
 * puts it in the reader's language (apps/web/src/messages → `errors.api`) —
 * `params` are the values its sentence needs, `blockers` the records behind
 * it, and `message` stays the English for logs and anyone reading the API
 * directly. A code the web doesn't know yet falls back to a calm generic
 * sentence, so adding one never breaks a screen.
 *
 *   throw new BadRequestException(problem('order.phone', 'enter a valid …'));
 */
export const problem = (
  code: string,
  message: string,
  params?: Record<string, string | number>,
  blockers?: Blocker[],
) => ({
  code,
  message,
  ...(params && { params }),
  ...(blockers?.length && { blockers }),
});

/**
 * Every reason an action is refused, as one error: `code` is the headline
 * ("this product can't be archived yet"), `reasons` each thing in the way —
 * so a person fixes them all in one go instead of discovering them one by one.
 */
export function refuse(code: string, message: string, reasons: Reason[]): never {
  throw new BadRequestException({ code, message, reasons });
}

/** For a screen to say before anyone clicks: nothing in the way is an empty list. */
export type Blocked = Reason[];
