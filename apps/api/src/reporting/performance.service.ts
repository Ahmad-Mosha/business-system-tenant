import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type Channel = 'noon' | 'website' | 'social' | 'wholesale';

interface Day {
  revenue: number;
  cogs: number;
  /** Channel fees, order shipping — the costs a channel brings with each sale. */
  direct: number;
  units: number;
  uncosted: number;
  count: number;
}

const blank = (): Day => ({ revenue: 0, cogs: 0, direct: 0, units: 0, uncosted: 0, count: 0 });
const money = (n: number) => n.toFixed(2);
const CAIRO_DAY = `(e.occurred_at AT TIME ZONE 'Africa/Cairo')::date`;
/** Neither a reversal nor reversed — a corrected mistake counts nowhere. */
const LIVE = `e.reverses_id IS NULL AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_id = e.id)`;

/**
 * Profit and loss for owners, built from the business's own records rather
 * than ledger postings: noon's imported statements, paid orders, posted
 * wholesale invoices, expenses and cash vouchers. Each figure says how sure it
 * is — wholesale cost of goods is the cost frozen at posting; orders' and
 * noon's is estimated at today's average cost; units with no cost at all are
 * counted, never guessed.
 *
 * Everything is summed per day, then rolled up into the period and the
 * monthly trend, so the two can never disagree.
 */
@Injectable()
export class PerformanceService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async report(from: string, to: string, months = 0) {
    // The trend covers whole months up to `to`; the queries cover both windows at once.
    const trendStart = months > 0 ? monthsBack(to, months - 1) : from;
    const start = trendStart < from ? trendStart : from;

    const [noon, orders, wholesale, expenses, vouchers] = await Promise.all([
      this.db.query(
        `SELECT t.transaction_date::text AS day,
                COALESCE(SUM(t.net_proceeds) FILTER (WHERE t.transaction_type IN ('order', 'order_update')), 0) AS revenue,
                -COALESCE(SUM(t.referral_fee + t.fulfilment_fee + t.shipping_credits + t.other_order_fees
                             + t.order_subsidies + t.non_order_fees + t.non_order_subsidies), 0) AS direct,
                COUNT(*) FILTER (WHERE t.transaction_type = 'order' AND t.item_nr IS NOT NULL)::int AS units,
                COALESCE(SUM(v.unit_cost) FILTER (WHERE t.transaction_type = 'order' AND t.item_nr IS NOT NULL), 0)
                  - COALESCE(SUM(v.unit_cost) FILTER (WHERE t.transaction_type = 'order_update' AND t.net_proceeds < 0), 0) AS cogs,
                COUNT(*) FILTER (WHERE t.transaction_type = 'order' AND t.item_nr IS NOT NULL AND v.unit_cost IS NULL)::int AS uncosted,
                COUNT(DISTINCT t.order_nr) FILTER (WHERE t.transaction_type = 'order')::int AS count
         FROM noon_transaction t
         LEFT JOIN channel_listing l ON l.id = t.listing_id
         LEFT JOIN product_variant v ON v.id = l.variant_id
         WHERE t.transaction_date BETWEEN $1::date AND $2::date
         GROUP BY 1`,
        [start, to],
      ),
      // The owners' measure for orders: what was paid, less the shipping
      // captured with the payment; a return or reversal carries the same
      // figures with the opposite sign.
      this.db.query(
        `SELECT ${CAIRO_DAY}::text AS day, o.source,
                SUM(s.sign * e.amount) AS revenue,
                SUM(s.sign * COALESCE(e.order_shipping_cost, 0)) AS direct,
                SUM(s.sign * COALESCE(c.cost, 0)) AS cogs,
                SUM(s.sign * COALESCE(c.units, 0))::int AS units,
                SUM(s.sign * COALESCE(c.uncosted, 0))::int AS uncosted,
                COUNT(DISTINCT o.id) FILTER (WHERE s.sign = 1)::int AS count
         FROM ledger_entry e
         CROSS JOIN LATERAL (SELECT CASE WHEN e.credit_code = 'SALES' THEN 1 ELSE -1 END AS sign) s
         JOIN customer_order o ON o.id::text = e.source_id
         LEFT JOIN LATERAL (
           SELECT SUM(i.quantity * v.unit_cost) AS cost,
                  SUM(i.quantity) AS units,
                  SUM(i.quantity) FILTER (WHERE v.unit_cost IS NULL) AS uncosted
           FROM order_item i LEFT JOIN product_variant v ON v.id = i.variant_id
           WHERE i.order_id = o.id
         ) c ON true
         WHERE e.source_type = 'order' AND e.kind IN ('ORDER_SALE', 'RETURN')
           AND (e.debit_code = 'SALES' OR e.credit_code = 'SALES')
           AND ${CAIRO_DAY} BETWEEN $1::date AND $2::date
         GROUP BY 1, 2`,
        [start, to],
      ),
      this.db.query(
        `SELECT s.invoice_date::text AS day,
                SUM(s.total) AS revenue,
                SUM(COALESCE(c.cost, 0)) AS cogs,
                SUM(COALESCE(c.units, 0))::int AS units,
                COUNT(*)::int AS count
         FROM sales_invoice s
         LEFT JOIN LATERAL (
           SELECT SUM(l.quantity * l.unit_cost) AS cost, SUM(l.quantity) AS units
           FROM sales_invoice_line l WHERE l.invoice_id = s.id
         ) c ON true
         WHERE s.status = 'POSTED' AND s.invoice_date BETWEEN $1::date AND $2::date
         GROUP BY 1`,
        [start, to],
      ),
      this.db.query(
        `SELECT x.spent_on::text AS day, c.name, SUM(x.amount) AS amount
         FROM expense x JOIN expense_category c ON c.id = x.category_id
         WHERE x.voided_at IS NULL AND x.spent_on BETWEEN $1::date AND $2::date
         GROUP BY 1, 2`,
        [start, to],
      ),
      // Cash vouchers booked straight to a cost — fees, shipping or other costs
      // paid without an expense record.
      this.db.query(
        `SELECT ${CAIRO_DAY}::text AS day, e.debit_code AS code, SUM(e.amount) AS amount
         FROM ledger_entry e
         WHERE e.source_type = 'voucher' AND e.debit_code IN ('CHANNEL_FEES', 'SHIPPING', 'OTHER_EXPENSE')
           AND ${LIVE} AND ${CAIRO_DAY} BETWEEN $1::date AND $2::date
         GROUP BY 1, 2`,
        [start, to],
      ),
    ]);

    const inPeriod = (day: string) => day >= from && day <= to;
    const channels = new Map<Channel, Day>((['noon', 'website', 'social', 'wholesale'] as const).map((c) => [c, blank()]));
    const add = (channel: Channel, r: Partial<Record<keyof Day, string | number>>) => {
      const d = channels.get(channel)!;
      for (const k of Object.keys(d) as Array<keyof Day>) d[k] += Number(r[k] ?? 0);
    };
    const byMonth = new Map<string, { revenue: number; costs: number }>();
    /** Adds a day's revenue and costs to its month of the trend. */
    const toMonth = (day: string, revenue: string | number, costs: number) => {
      if (day < trendStart) return;
      const m = byMonth.get(day.slice(0, 7)) ?? { revenue: 0, costs: 0 };
      byMonth.set(day.slice(0, 7), { revenue: m.revenue + Number(revenue), costs: m.costs + costs });
    };

    for (const r of noon) {
      if (inPeriod(r.day)) add('noon', r);
      toMonth(r.day, r.revenue, Number(r.cogs) + Number(r.direct));
    }
    for (const r of orders) {
      const channel: Channel = r.source === 'EASYORDERS' ? 'website' : 'social';
      if (inPeriod(r.day)) add(channel, r);
      toMonth(r.day, r.revenue, Number(r.cogs) + Number(r.direct));
    }
    for (const r of wholesale) {
      if (inPeriod(r.day)) add('wholesale', r);
      toMonth(r.day, r.revenue, Number(r.cogs));
    }

    const categories = new Map<string, number>();
    let expenseTotal = 0;
    for (const r of expenses) {
      if (inPeriod(r.day)) {
        categories.set(r.name, (categories.get(r.name) ?? 0) + Number(r.amount));
        expenseTotal += Number(r.amount);
      }
      toMonth(r.day, 0, Number(r.amount));
    }
    const voucher = { CHANNEL_FEES: 0, SHIPPING: 0, OTHER_EXPENSE: 0 } as Record<string, number>;
    for (const r of vouchers) {
      if (inPeriod(r.day)) voucher[r.code] += Number(r.amount);
      toMonth(r.day, 0, Number(r.amount));
    }

    const list = [...channels.entries()].map(([key, d]) => ({
      key,
      revenue: money(d.revenue),
      cogs: money(d.cogs),
      // Wholesale cost was frozen when each invoice was posted; the rest is today's average cost.
      cogsBasis: key === 'wholesale' ? ('actual' as const) : ('estimate' as const),
      directCosts: money(d.direct),
      contribution: money(d.revenue - d.cogs - d.direct),
      units: d.units,
      uncostedUnits: d.uncosted,
      count: d.count,
    }));
    const sum = (k: keyof Day) => [...channels.values()].reduce((n, d) => n + d[k], 0);
    const revenue = sum('revenue');
    const cogs = sum('cogs');
    const fees = channels.get('noon')!.direct + voucher.CHANNEL_FEES;
    const shipping = channels.get('website')!.direct + channels.get('social')!.direct + voucher.SHIPPING;
    const otherCosts = expenseTotal + voucher.OTHER_EXPENSE;
    const netProfit = revenue - cogs - fees - shipping - otherCosts;

    const trend: Array<{ month: string; revenue: string; costs: string; netProfit: string }> = [];
    if (months > 0) {
      for (let i = months - 1; i >= 0; i--) {
        const key = monthsBack(to, i).slice(0, 7);
        const m = byMonth.get(key) ?? { revenue: 0, costs: 0 };
        trend.push({ month: key, revenue: money(m.revenue), costs: money(m.costs), netProfit: money(m.revenue - m.costs) });
      }
    }

    return {
      from,
      to,
      revenue: money(revenue),
      cogs: money(cogs),
      grossProfit: money(revenue - cogs),
      fees: money(fees),
      shipping: money(shipping),
      expenses: money(otherCosts),
      netProfit: money(netProfit),
      uncostedUnits: sum('uncosted'),
      channels: list,
      expenseCategories: [
        ...[...categories.entries()].map(([name, amount]) => ({ name, amount: money(amount) })),
        ...(voucher.OTHER_EXPENSE > 0 ? [{ name: null, amount: money(voucher.OTHER_EXPENSE) }] : []),
      ].sort((a, b) => Number(b.amount) - Number(a.amount)),
      trend,
    };
  }
}

/** The first day of the month `n` months before the month of `date`. */
function monthsBack(date: string, n: number) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}
