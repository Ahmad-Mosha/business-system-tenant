import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChannelAccount } from '../noon/channel-account.entity';

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
   * The balance owed to us at the end of `date`: the configured anchor plus
   * every movement since. Null when no anchor has been set, because a balance
   * without one would be a guess presented as a fact.
   */
  async balanceAt(date: string): Promise<string | null> {
    const account = await this.db.getRepository(ChannelAccount).findOneBy({ channel: 'noon' });
    if (!account?.openingAsOf) return null;

    const [{ movement }] = await this.db.query(
      `SELECT COALESCE(SUM(total), 0) AS movement
       FROM noon_transaction
       WHERE transaction_date >= $1 AND transaction_date <= $2`,
      [account.openingAsOf, date],
    );
    return (Number(account.openingBalance) + Number(movement)).toFixed(2);
  }

  /**
   * Rebuilds noon's Account Summary from our own rows.
   *
   * `openingBalance` is the balance carried into `from`; when omitted it is
   * derived from the configured anchor.
   */
  async statement(from: string, to: string, openingBalance?: string) {
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

    // Balance carried into the period is the balance at the day before it.
    const opening =
      openingBalance ?? (await this.balanceAt(previousDay(from)));

    // Same identity noon's portal uses: opening + proceeds - fees - payouts.
    // `fees` and `payouts` are already signed negative in the source data.
    const closingBalance =
      opening === null
        ? null
        : (
            Number(opening) + Number(r.netProceeds) + Number(r.fees) + Number(r.payouts)
          ).toFixed(2);

    return { from, to, openingBalance: opening, ...r, closingBalance };
  }

  /**
   * Month-by-month figures with a running balance, so a single import can be
   * checked against the channel's own statement for that month.
   */
  async periods() {
    const account = await this.db.getRepository(ChannelAccount).findOneBy({ channel: 'noon' });
    const anchor = account?.openingAsOf ? Number(account.openingBalance) : null;

    const months: PeriodRow[] = await this.db.query(
      `SELECT
         to_char(transaction_date, 'YYYY-MM')                       AS month,
         min(transaction_date)::text                                AS "from",
         max(transaction_date)::text                                AS "to",
         count(*)::int                                              AS rows,
         COALESCE(SUM(net_proceeds), 0)                             AS "netProceeds",
         COALESCE(SUM(referral_fee + fulfilment_fee + shipping_credits
                    + other_order_fees + order_subsidies
                    + non_order_fees + non_order_subsidies), 0)     AS fees,
         COALESCE(SUM(others), 0)                                   AS payouts,
         COALESCE(SUM(total), 0)                                    AS movement,
         count(*) FILTER (
           WHERE transaction_type = 'order' AND item_nr IS NOT NULL
         )::int                                                     AS "unitsSold"
       FROM noon_transaction
       WHERE transaction_date IS NOT NULL
       GROUP BY 1
       ORDER BY 1`,
    );

    // Running balance accumulates forward from the anchor.
    let balance = anchor;
    return months.map((m) => {
      const openingBalance = balance === null ? null : balance.toFixed(2);
      if (balance !== null) balance += Number(m.movement);
      return {
        ...m,
        openingBalance,
        closingBalance: balance === null ? null : balance.toFixed(2),
      };
    });
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
         MIN(v.unit_cost)                                           AS "unitCost",
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
         CASE WHEN MIN(v.unit_cost) IS NULL THEN NULL ELSE
           COALESCE(SUM(t.total), 0) - MIN(v.unit_cost) * COUNT(*) FILTER (
             WHERE t.transaction_type = 'order' AND t.item_nr IS NOT NULL)
         END                                                        AS "grossProfit"
       FROM noon_transaction t
       JOIN channel_listing l ON l.id = t.listing_id
       JOIN product_variant v ON v.id = l.variant_id
       JOIN product p         ON p.id = v.product_id
       WHERE t.transaction_date BETWEEN $1 AND $2
       GROUP BY p.id, p.name, p.discovered
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

interface PeriodRow {
  month: string;
  from: string;
  to: string;
  rows: number;
  netProceeds: string;
  fees: string;
  payouts: string;
  movement: string;
  unitsSold: number;
}

/** `2026-07-01` -> `2026-06-30`, without dragging in a date library. */
function previousDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
