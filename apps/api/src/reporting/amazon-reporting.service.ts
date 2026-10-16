import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChannelAccount } from '../noon/channel-account.entity';

/** The business day a line was posted on — Cairo's, not UTC's. */
const DAY = `(t.posted_at AT TIME ZONE 'Africa/Cairo')::date`;
/** What the customer paid on a line: the item, its shipping, less promotions. */
const SOLD = `(t.product_sales + t.shipping_credits + t.promotional_rebates)`;

/**
 * Amazon's figures, rebuilt from the imported report lines the way Amazon's
 * own date-range summary groups them: income, then fees and charges, then
 * transfers to the bank. The lines always add up to the movement in the
 * balance — `other` is whatever the named lines leave over.
 */
@Injectable()
export class AmazonReportingService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /** What Amazon owes at the end of `date`, from the configured anchor; null without one. */
  async balanceAt(date: string): Promise<string | null> {
    const account = await this.db.getRepository(ChannelAccount).findOneBy({ channel: 'amazon' });
    if (!account?.openingAsOf) return null;
    const [{ movement }] = await this.db.query(
      `SELECT COALESCE(SUM(t.total), 0) AS movement FROM amazon_transaction t WHERE ${DAY} BETWEEN $1 AND $2`,
      [account.openingAsOf, date],
    );
    return (Number(account.openingBalance) + Number(movement)).toFixed(2);
  }

  async statement(from: string, to: string) {
    const [r] = await this.db.query(
      `SELECT
         COALESCE(SUM(${SOLD}) FILTER (WHERE t.type = 'Order'), 0)                        AS sales,
         COALESCE(SUM(${SOLD}) FILTER (WHERE t.type = 'Refund'), 0)                       AS refunds,
         COALESCE(SUM(t.selling_fees) FILTER (WHERE t.type IN ('Order', 'Refund')), 0)   AS "sellingFees",
         COALESCE(SUM(t.total) FILTER (WHERE t.type = 'Amazon Fees'), 0)                 AS "shippingCharges",
         COALESCE(SUM(t.fba_fees) FILTER (WHERE t.type IN ('Order', 'Refund')), 0)       AS "fulfilmentFees",
         COALESCE(SUM(t.total) FILTER (WHERE t.type = 'Service Fee'), 0)                 AS "serviceFees",
         COALESCE(SUM(t.total) FILTER (WHERE t.type = 'Adjustment'), 0)                  AS adjustments,
         COALESCE(SUM(t.total) FILTER (WHERE t.type = 'Transfer'), 0)                    AS payouts,
         COALESCE(SUM(t.total), 0)                                                        AS movement,
         COALESCE(SUM(t.total) FILTER (WHERE t.status = 'Deferred' AND t.type <> 'Transfer'), 0) AS held,
         max(t.release_at) FILTER (WHERE t.status = 'Deferred')                          AS "heldUntil",
         COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'Order'), 0)::int               AS "unitsSold",
         COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'Refund'), 0)::int              AS "unitsRefunded",
         COUNT(DISTINCT t.order_id) FILTER (WHERE t.type = 'Order')::int                 AS orders,
         COUNT(*)::int                                                                    AS rows
       FROM amazon_transaction t
       WHERE ${DAY} BETWEEN $1 AND $2`,
      [from, to],
    );
    const n = (k: string) => Number(r[k]);
    const income = n('sales') + n('refunds');
    const named = n('sellingFees') + n('shippingCharges') + n('fulfilmentFees') + n('serviceFees') + n('adjustments');
    const fees = n('movement') - n('payouts') - income;
    const opening = await this.balanceAt(previousDay(from));
    return {
      from,
      to,
      ...r,
      income: income.toFixed(2),
      other: (fees - named).toFixed(2),
      fees: fees.toFixed(2),
      net: (income + fees).toFixed(2),
      openingBalance: opening,
      closingBalance: opening === null ? null : (Number(opening) + n('movement')).toFixed(2),
    };
  }

  /** Month by month, with the balance running forward from the anchor. */
  async periods() {
    const account = await this.db.getRepository(ChannelAccount).findOneBy({ channel: 'amazon' });
    const months: Array<{ month: string; from: string; to: string; income: string; fees: string; payouts: string; movement: string; unitsSold: number; rows: number }> =
      await this.db.query(
        `SELECT to_char(${DAY}, 'YYYY-MM') AS month,
                min(${DAY})::text AS "from",
                max(${DAY})::text AS "to",
                COUNT(*)::int AS rows,
                COALESCE(SUM(${SOLD}) FILTER (WHERE t.type IN ('Order', 'Refund')), 0) AS income,
                COALESCE(SUM(t.total) FILTER (WHERE t.type <> 'Transfer'), 0)
                  - COALESCE(SUM(${SOLD}) FILTER (WHERE t.type IN ('Order', 'Refund')), 0) AS fees,
                COALESCE(SUM(t.total) FILTER (WHERE t.type = 'Transfer'), 0) AS payouts,
                COALESCE(SUM(t.total), 0) AS movement,
                COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'Order'), 0)::int AS "unitsSold"
         FROM amazon_transaction t
         GROUP BY 1 ORDER BY 1`,
      );
    let balance = account?.openingAsOf ? Number(account.openingBalance) : null;
    return months.map((m) => {
      const openingBalance = balance === null ? null : balance.toFixed(2);
      if (balance !== null) balance += Number(m.movement);
      return {
        ...m,
        fees: Number(m.fees).toFixed(2),
        openingBalance,
        closingBalance: balance === null ? null : balance.toFixed(2),
      };
    });
  }

  /** Per product: units, what customers paid, Amazon's share, and what was left. */
  async productPerformance(from: string, to: string) {
    return this.db.query(
      `SELECT p.id AS "productId", p.name,
              MIN(v.unit_cost) AS "unitCost",
              COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'Order'), 0)::int AS "unitsSold",
              COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'Refund'), 0)::int AS "unitsReturned",
              COALESCE(SUM(${SOLD}) FILTER (WHERE t.type IN ('Order', 'Refund')), 0) AS income,
              COALESCE(SUM(t.total), 0) - COALESCE(SUM(${SOLD}) FILTER (WHERE t.type IN ('Order', 'Refund')), 0) AS fees,
              COALESCE(SUM(t.total), 0) AS net,
              CASE WHEN MIN(v.unit_cost) IS NULL THEN NULL ELSE
                COALESCE(SUM(t.total), 0) - MIN(v.unit_cost) * (
                  COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'Order'), 0)
                  - COALESCE(SUM(t.quantity) FILTER (WHERE t.type = 'Refund'), 0))
              END AS "grossProfit"
       FROM amazon_transaction t
       JOIN channel_listing l ON l.id = t.listing_id
       JOIN product_variant v ON v.id = l.variant_id
       JOIN product p ON p.id = v.product_id
       WHERE ${DAY} BETWEEN $1 AND $2
       GROUP BY p.id, p.name
       ORDER BY COALESCE(SUM(t.total), 0) DESC`,
      [from, to],
    );
  }

  /** Lines no product owns — transfers, subscriptions, charges on orders of several products. */
  async unattributed(from: string, to: string) {
    return this.db.query(
      `SELECT t.type AS "transactionType", COUNT(*)::int AS rows, COALESCE(SUM(t.total), 0) AS total
       FROM amazon_transaction t
       WHERE ${DAY} BETWEEN $1 AND $2 AND t.listing_id IS NULL
       GROUP BY t.type ORDER BY SUM(t.total)`,
      [from, to],
    );
  }
}

/** `2026-08-01` → `2026-07-31`. */
function previousDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
