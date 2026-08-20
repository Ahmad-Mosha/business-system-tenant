import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Read models over `noon_transaction`.
 *
 * Every figure here is a SUM over stored rows — nothing is cached and nothing
 * is written back, so a number can always be explained by the lines beneath it.
 * The arithmetic is done by Postgres in `numeric`, never in JavaScript floats.
 */
@Injectable()
export class NoonReportingService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  /**
   * Rebuilds noon's Account Summary from our own rows.
   *
   * `openingBalance` cannot be derived — it is whatever noon carried in before
   * the first row we hold — so the caller supplies it to close the loop.
   */
  async statement(from: string, to: string, openingBalance = '0') {
    const [r] = await this.db.query(
      `SELECT
         COALESCE(SUM(net_proceeds), 0)                            AS "netProceeds",
         COALESCE(SUM(referral_fee), 0)                            AS "referralFee",
         COALESCE(SUM(fulfilment_fee), 0)                          AS "fulfilmentFee",
         COALESCE(SUM(shipping_credits), 0)                        AS "shippingCredits",
         COALESCE(SUM(other_order_fees), 0)                        AS "otherOrderFees",
         COALESCE(SUM(order_subsidies), 0)                         AS "orderSubsidies",
         COALESCE(SUM(non_order_fees), 0)                          AS "advertisingFee",
         COALESCE(SUM(non_order_subsidies), 0)                     AS "advertisingSubsidy",
         COALESCE(SUM(referral_fee + fulfilment_fee + shipping_credits
                    + other_order_fees + order_subsidies
                    + non_order_fees + non_order_subsidies), 0)    AS "fees",
         COALESCE(SUM(others), 0)                                  AS "payouts",
         COALESCE(SUM(total), 0)                                   AS "movement",
         COUNT(*)::int                                             AS "rows"
       FROM noon_transaction
       WHERE transaction_date BETWEEN $1 AND $2`,
      [from, to],
    );

    // Same identity noon's portal uses: opening + proceeds - fees - payouts.
    // `fees` and `payouts` are already signed negative in the source data.
    const closing = (
      Number(openingBalance) + Number(r.netProceeds) + Number(r.fees) + Number(r.payouts)
    ).toFixed(2);

    return { from, to, openingBalance, ...r, closingBalance: closing };
  }

  /**
   * Per-product performance. Units are a COUNT of item lines because noon
   * ships no quantity column — one row is one unit.
   */
  async productPerformance(from: string, to: string) {
    return this.db.query(
      `SELECT
         p.id                                                       AS "productId",
         p.name,
         p.discovered,
         p.unit_cost                                                AS "unitCost",
         COUNT(*) FILTER (
           WHERE t.transaction_type = 'order' AND t.item_nr IS NOT NULL
         )::int                                                     AS "unitsSold",
         COUNT(*) FILTER (
           WHERE t.transaction_type = 'order_update' AND t.net_proceeds < 0
         )::int                                                     AS "unitsReturned",
         COALESCE(SUM(t.net_proceeds), 0)                           AS "netProceeds",
         COALESCE(SUM(t.referral_fee), 0)                           AS "referralFee",
         COALESCE(SUM(t.fulfilment_fee), 0)                         AS "fulfilmentFee",
         COALESCE(SUM(t.shipping_credits + t.other_order_fees
                    + t.order_subsidies), 0)                        AS "otherFees",
         COALESCE(SUM(t.total), 0)                                  AS "net",
         -- Null until a cost basis is entered; no marketplace report has one.
         CASE WHEN p.unit_cost IS NULL THEN NULL ELSE
           COALESCE(SUM(t.total), 0) - p.unit_cost * COUNT(*) FILTER (
             WHERE t.transaction_type = 'order' AND t.item_nr IS NOT NULL)
         END                                                        AS "grossProfit"
       FROM noon_transaction t
       JOIN channel_listing l ON l.id = t.listing_id
       JOIN product p         ON p.id = l.product_id
       WHERE t.transaction_date BETWEEN $1 AND $2
       GROUP BY p.id, p.name, p.discovered, p.unit_cost
       ORDER BY COALESCE(SUM(t.total), 0) DESC`,
      [from, to],
    );
  }

  /**
   * Money in the period that belongs to no product — payouts, advertising,
   * shipping-only lines. Surfaced rather than hidden: it is real cost that
   * per-product figures will never account for.
   */
  async unattributed(from: string, to: string) {
    return this.db.query(
      `SELECT
         transaction_type                 AS "transactionType",
         COUNT(*)::int                    AS "rows",
         COALESCE(SUM(total), 0)          AS "total"
       FROM noon_transaction
       WHERE transaction_date BETWEEN $1 AND $2
         AND listing_id IS NULL
       GROUP BY transaction_type
       ORDER BY SUM(total)`,
      [from, to],
    );
  }
}
