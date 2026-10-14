import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { ProductVariant } from '../catalog/product-variant.entity';
import { LedgerEntry } from '../finance/ledger-entry.entity';
import { LedgerService } from '../finance/ledger.service';
import { StockMovement } from '../inventory/stock-movement.entity';
import { isUniqueViolation } from '../database/unique-violation';
import { lockStock } from '../inventory/stock-lock';
import { problem, refuse, type Reason } from '../problem';
import { archivedProducts } from '../catalog/product-blockers';
import { lineTotalFor, round2, unitCostFor } from '../purchasing/costing';
import { Customer } from './customer.entity';
import { SalesInvoice, SalesInvoiceLine } from './sales-invoice.entity';

const MONEY = /^\d+(\.\d{1,2})?$/;
const UNIT_PRICE = /^\d+(\.\d{1,4})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (n: number) => n.toFixed(2);

/** A line is typed as quantity × unit price, or as quantity + line total (which then wins). */
export interface SalesLineInput {
  variantId: string;
  quantity: number;
  unitPrice?: string;
  lineTotal?: string;
}

export interface SalesInvoiceInput {
  /** The form's submission id; the same id never creates a second invoice. */
  requestId?: string;
  customerId: string;
  invoiceDate: string;
  discount?: string;
  notes?: string;
  lines: SalesLineInput[];
}

@Injectable()
export class SalesService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly ledger: LedgerService,
  ) {}

  // ── Customers ──────────────────────────────────────────────────────────

  /** What each customer still owes: the unpaid remainder of their posted invoices. */
  private async owedByCustomer(tx: DataSource | EntityManager = this.db): Promise<Map<string, number>> {
    const rows: Array<{ customerId: string; owed: string }> = await tx.query(
      `SELECT customer_id AS "customerId", COALESCE(SUM(total - paid_amount), 0) AS owed
       FROM sales_invoice WHERE status = 'POSTED' GROUP BY customer_id`,
    );
    return new Map(rows.map((r) => [r.customerId, Number(r.owed)]));
  }

  /** Active customers for everyday use; `archived` lists the archived ones instead. */
  async listCustomers(archived = false) {
    const customers = await this.db.getRepository(Customer).find({
      where: { active: !archived },
      order: { name: 'ASC' },
    });
    const owed = await this.owedByCustomer();
    return customers.map((c) => ({ ...c, balance: money(owed.get(c.id) ?? 0) }));
  }

  async createCustomer(input: { name?: string; phone?: string; note?: string }) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException(problem('customer.name', 'enter the customer name'));
    return this.db.getRepository(Customer).save({
      name,
      phone: input.phone?.trim() || null,
      note: input.note?.trim() || null,
      active: true,
    });
  }

  async customerDetail(id: string) {
    const customer = await this.db.getRepository(Customer).findOneBy({ id });
    if (!customer) throw new NotFoundException(problem('notFound', 'customer not found'));
    const invoices = await this.invoiceRows('i.customer_id = $1', [id]);
    const owed = (await this.owedByCustomer()).get(id) ?? 0;
    return { ...customer, balance: money(owed), invoices, blocked: await this.customerBlockers(this.db, id) };
  }

  /**
   * Edits a customer, or archives / restores one. Archiving keeps the history
   * but is refused while they owe money or a draft invoice names them.
   */
  async updateCustomer(id: string, patch: { name?: string; phone?: string | null; note?: string | null; active?: boolean }) {
    return this.db.transaction(async (tx) => {
      const customer = await tx.findOne(Customer, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!customer) throw new NotFoundException(problem('notFound', 'customer not found'));
      if (patch.name !== undefined) {
        if (!patch.name.trim()) throw new BadRequestException(problem('customer.name', 'enter the customer name'));
        customer.name = patch.name.trim();
      }
      if (patch.phone !== undefined) customer.phone = patch.phone?.trim() || null;
      if (patch.note !== undefined) customer.note = patch.note?.trim() || null;
      if (patch.active === false && customer.active) {
        const blocked = (await this.customerBlockers(tx, id)).archive;
        if (blocked.length) refuse('customer.archiveBlocked', 'collect what is owed and finish drafts before archiving this customer', blocked);
      }
      if (patch.active !== undefined) customer.active = patch.active;
      return tx.save(customer);
    });
  }

  /** Deletes a customer entered by mistake — only one with no invoices at all. */
  async deleteCustomer(id: string) {
    await this.db.transaction(async (tx) => {
      const customer = await tx.findOne(Customer, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!customer) throw new NotFoundException(problem('notFound', 'customer not found'));
      const blocked = (await this.customerBlockers(tx, id)).delete;
      if (blocked.length) refuse('customer.deleteBlocked', 'this customer has invoices — archive them instead', blocked);
      await tx.delete(Customer, { id });
    });
  }

  /**
   * What stands in the way of deleting or archiving a customer — read by their
   * screen and enforced by both actions. Delete: any invoice, for good.
   * Archive: an unpaid posted invoice, or a draft still naming them.
   */
  private async customerBlockers(tx: DataSource | EntityManager, id: string): Promise<{ delete: Reason[]; archive: Reason[] }> {
    const invoices: Array<{ id: string; label: string | null; date: string; detail: string; left: string }> = await tx.query(
      `SELECT id, invoice_number AS label, invoice_date::text AS date, status AS detail, (total - paid_amount)::text AS "left"
       FROM sales_invoice WHERE customer_id = $1 ORDER BY invoice_date DESC, created_at DESC`,
      [id],
    );
    const owing = invoices.filter((i) => i.detail === 'POSTED' && Number(i.left) > 0.005);
    const drafts = invoices.filter((i) => i.detail === 'DRAFT');
    const owed = owing.reduce((n, i) => n + Number(i.left), 0);
    const asBlockers = (rows: typeof invoices, withLeft = false) =>
      rows.slice(0, 5).map((r) => ({ kind: 'sales_invoice' as const, id: r.id, label: r.label ?? undefined, date: r.date, detail: r.detail, amount: withLeft ? r.left : undefined }));
    return {
      delete: invoices.length ? [{ code: 'customer.hasInvoices', params: { count: invoices.length }, blockers: asBlockers(invoices) }] : [],
      archive: [
        ...(owing.length ? [{ code: 'customer.archiveOwed', params: { owed: money(owed) }, blockers: asBlockers(owing, true) }] : []),
        ...(drafts.length ? [{ code: 'customer.archiveDrafts', params: { count: drafts.length }, blockers: asBlockers(drafts) }] : []),
      ],
    };
  }

  // ── Sales invoices ─────────────────────────────────────────────────────

  private invoiceRows(where = 'TRUE', params: unknown[] = []) {
    return this.db.query(
      `SELECT i.id, i.invoice_number AS "invoiceNumber", i.invoice_date::text AS "invoiceDate", i.status,
              i.goods_total AS "goodsTotal", i.discount, i.total, i.paid_amount AS "paidAmount",
              i.customer_id AS "customerId", c.name AS "customerName", i.updated_at AS "updatedAt",
              (SELECT count(*)::int FROM sales_invoice_line l WHERE l.invoice_id = i.id) AS "lineCount"
       FROM sales_invoice i JOIN customer c ON c.id = i.customer_id
       WHERE ${where}
       ORDER BY i.invoice_date DESC, i.created_at DESC
       LIMIT 200`,
      params,
    );
  }

  /** Live invoices; `cancelled` brings the voided ones back. */
  listInvoices(cancelled = false) {
    return this.invoiceRows(cancelled ? 'TRUE' : "i.status <> 'VOID'");
  }

  async getInvoice(id: string) {
    const invoice = await this.db.getRepository(SalesInvoice).findOne({ where: { id }, relations: { customer: true } });
    if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
    // Today's warehouse stock and cost beside each line, so a draft shows what
    // posting it would leave behind.
    const lines = await this.db.query(
      `SELECT l.id, l.variant_id AS "variantId", l.quantity, l.unit_price AS "unitPrice",
              l.line_total AS "lineTotal", l.unit_cost AS "unitCost",
              v.unit_cost AS "currentCost",
              COALESCE((SELECT SUM(m.quantity) FROM stock_movement m
                        WHERE m.variant_id = v.id AND m.location = 'WAREHOUSE'), 0)::int AS "onHand",
              CASE WHEN v.name = 'Default' THEN p.name ELSE p.name || ' — ' || v.name END AS label
       FROM sales_invoice_line l
       JOIN product_variant v ON v.id = l.variant_id
       JOIN product p ON p.id = v.product_id
       WHERE l.invoice_id = $1
       ORDER BY l.id`,
      [id],
    );
    const payments = await this.db.query(
      `SELECT e.id, e.amount, e.occurred_at AS "occurredAt", e.memo,
              EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_id = e.id) AS reversed,
              (SELECT r.reason FROM ledger_entry r WHERE r.reverses_id = e.id LIMIT 1) AS "reversedReason"
       FROM ledger_entry e
       WHERE e.source_type = 'sales_invoice' AND e.source_id = $1 AND e.kind = 'CUSTOMER_PAYMENT'
         AND e.reverses_id IS NULL
       ORDER BY e.occurred_at, e.created_at`,
      [id],
    );
    const [voider] = invoice.voidedById
      ? await this.db.query('SELECT name FROM app_user WHERE id = $1', [invoice.voidedById])
      : [];
    const blocked = {
      post: invoice.status === 'DRAFT' && lines.length
        ? (await this.postBlockers(this.db, invoice.customerId, lines as Array<{ variantId: string; quantity: number }>)).reasons
        : [],
      void: invoice.status === 'POSTED' ? await this.voidBlockers(this.db, invoice) : [],
    };
    return { ...invoice, voidedBy: voider?.name ?? null, lines, payments, blocked };
  }

  /** Creates a DRAFT invoice — nothing leaves stock or reaches the books until it is posted. */
  async createDraft(input: SalesInvoiceInput, userId: string) {
    this.validate(input);
    const requestId = input.requestId || null;
    const earlier = requestId ? await this.db.getRepository(SalesInvoice).findOneBy({ requestId }) : null;
    if (earlier) return this.getInvoice(earlier.id);
    const { lines, header } = this.price(input);

    // A concurrent resend of the same request waits on the unique key, then gets the first invoice.
    const id = await this.db
      .transaction(async (tx) => {
        await this.assertUsable(tx, input);
        const invoice = await tx.save(SalesInvoice, { requestId, ...header, status: 'DRAFT' as const, createdById: userId });
        await tx.insert(SalesInvoiceLine, lines.map((l) => ({ ...l, invoiceId: invoice.id })));
        return invoice.id;
      })
      .catch(async (error: unknown) => {
        const first = requestId && isUniqueViolation(error, 'uq_sales_invoice_request')
          ? await this.db.getRepository(SalesInvoice).findOneBy({ requestId })
          : null;
        if (!first) throw error;
        return first.id;
      });
    return this.getInvoice(id);
  }

  /** Rewrites a draft exactly as `createDraft` would build it; a posted invoice is refused. */
  async updateDraft(id: string, input: SalesInvoiceInput) {
    this.validate(input);
    const { lines, header } = this.price(input);
    await this.db.transaction(async (tx) => {
      const invoice = await tx.findOne(SalesInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      if (invoice.status !== 'DRAFT') throw new BadRequestException(problem('sales.postedEdit', 'a posted invoice cannot be edited'));
      await this.assertUsable(tx, input);
      await tx.update(SalesInvoice, { id }, header);
      await tx.delete(SalesInvoiceLine, { invoiceId: id });
      await tx.insert(SalesInvoiceLine, lines.map((l) => ({ ...l, invoiceId: id })));
    });
    return this.getInvoice(id);
  }

  /** Deletes a draft — it never moved stock or money. */
  async deleteDraft(id: string) {
    await this.db.transaction(async (tx) => {
      const invoice = await tx.findOne(SalesInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      if (invoice.status !== 'DRAFT') throw new BadRequestException(problem('sales.postedDelete', 'a posted invoice cannot be deleted'));
      await tx.delete(SalesInvoice, { id });
    });
  }

  /**
   * Posts a draft — the one moment a sales invoice has effects, all in one
   * transaction: the goods leave the warehouse (refused if any are short),
   * each line keeps its inventory cost at this moment (its profit is then
   * fixed), the invoice gets its number, the whole total is booked as revenue
   * owed by the customer, and `paidNow` (0 to the total) is received in cash.
   */
  async postInvoice(id: string, paidNow: string | undefined, userId: string) {
    const paid = paidNow === undefined || paidNow === '' ? 0 : Number(paidNow);
    if ((paidNow && !MONEY.test(paidNow)) || !Number.isFinite(paid) || paid < 0) {
      throw new BadRequestException(problem('sales.paidNow', 'enter the amount paid now like 300.00'));
    }
    await this.db.transaction(async (tx) => {
      const invoice = await tx.findOne(SalesInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      if (invoice.status !== 'DRAFT') throw new BadRequestException(problem('sales.posted', 'this invoice is already posted'));
      const total = Number(invoice.total);
      if (paid > total + 0.005) {
        throw new BadRequestException(problem('sales.overpaid', 'the amount paid cannot exceed the invoice total', { total: money(total) }));
      }
      const lines = await tx.find(SalesInvoiceLine, { where: { invoiceId: id }, order: { id: 'ASC' } });
      if (!lines.length) throw new BadRequestException(problem('sales.noLines', 'add at least one product'));
      await lockStock(tx, lines.map((l) => l.variantId));
      const { reasons, stock } = await this.postBlockers(tx, invoice.customerId, lines);
      if (reasons.length) refuse('sales.postBlocked', 'this invoice cannot be posted as it stands', reasons);
      const byId = new Map(stock.map((r) => [r.id, r]));

      const [{ nextval }] = await tx.query("SELECT nextval('sales_invoice_number_seq')");
      const number = `SI-${nextval}`;
      const occurredAt = new Date(`${invoice.invoiceDate}T00:00:00Z`);
      for (const l of lines) {
        const cost = byId.get(l.variantId)!.cost;
        await tx.update(SalesInvoiceLine, { id: l.id }, { unitCost: cost });
        await tx.insert(StockMovement, {
          variantId: l.variantId, location: 'WAREHOUSE', quantity: -l.quantity, reason: 'SALE', unitCost: cost,
          sourceType: 'sales_invoice', sourceId: id, createdById: userId, occurredAt, note: number,
        });
      }
      if (total > 0) {
        await this.ledger.post({
          amount: money(total), debit: 'CUSTOMER_RECEIVABLE', credit: 'SALES', kind: 'SALES_INVOICE', occurredAt,
          memo: `Sales invoice ${number}`, sourceType: 'sales_invoice', sourceId: id, actorId: userId,
        }, tx);
      }
      if (paid > 0) await this.receive(tx, invoice, paid, `Paid with ${number}`, userId, occurredAt);
      await tx.update(SalesInvoice, { id }, {
        status: 'POSTED', invoiceNumber: number, postedAt: new Date(), paidAmount: money(round2(paid)),
      });
    });
    return this.getInvoice(id);
  }

  /** Money received from the customer against one posted invoice — never more than is left on it. */
  async recordPayment(id: string, amount: string, memo: string | undefined, userId: string) {
    if (!MONEY.test(amount ?? '') || Number(amount) <= 0) {
      throw new BadRequestException(problem('sales.paymentAmount', 'enter an amount like 300.00'));
    }
    await this.db.transaction(async (tx) => {
      const invoice = await tx.findOne(SalesInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      if (invoice.status !== 'POSTED') throw new BadRequestException(problem('sales.notPosted', 'only a posted invoice takes payments'));
      const left = round2(Number(invoice.total) - Number(invoice.paidAmount));
      const value = round2(Number(amount));
      if (value > left + 0.005) {
        throw new BadRequestException(problem('sales.overpaid', 'the amount paid cannot exceed what is left', { total: money(left) }));
      }
      await this.receive(tx, invoice, value, memo?.trim() || `Payment for ${invoice.invoiceNumber}`, userId);
      await tx.update(SalesInvoice, { id }, { paidAmount: money(round2(Number(invoice.paidAmount) + value)) });
    });
    return this.getInvoice(id);
  }

  /** Undoes a payment recorded by mistake: the cash entry is reversed and the invoice is owed again. */
  async reversePayment(id: string, entryId: string, userId: string, reason?: string) {
    await this.db.transaction(async (tx) => {
      const invoice = await tx.findOne(SalesInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      const entry = await tx.findOneBy(LedgerEntry, { id: entryId, sourceType: 'sales_invoice', sourceId: id, kind: 'CUSTOMER_PAYMENT' });
      if (!entry || entry.reversesId) throw new NotFoundException(problem('notFound', 'payment not found'));
      if (await tx.exists(LedgerEntry, { where: { reversesId: entryId } })) {
        throw new BadRequestException(problem('sales.paymentReversed', 'this payment is already reversed'));
      }
      await this.ledger.reverse(entryId, userId, tx, reason);
      await tx.update(SalesInvoice, { id }, { paidAmount: money(round2(Number(invoice.paidAmount) - Number(entry.amount))) });
    });
    return this.getInvoice(id);
  }

  /**
   * Voids a posted invoice entered by mistake: the goods come back to the
   * warehouse at the cost they left with, the revenue entry is reversed, and
   * the invoice stays visible as VOID with the reason. Refused while any
   * payment stands — those are reversed first, so cash is never left orphaned.
   */
  async voidInvoice(id: string, reason: string, userId: string) {
    if (!reason?.trim() || reason.trim().length > 1000) {
      throw new BadRequestException(problem('sales.voidReason', 'enter why this invoice is voided'));
    }
    await this.db.transaction(async (tx) => {
      const invoice = await tx.findOne(SalesInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      if (invoice.status !== 'POSTED') throw new BadRequestException(problem('sales.notPosted', 'only a posted invoice can be voided'));
      const blocked = await this.voidBlockers(tx, invoice);
      if (blocked.length) refuse('sales.voidBlocked', 'reverse its payments before voiding this invoice', blocked);
      const lines = await tx.find(SalesInvoiceLine, { where: { invoiceId: id } });
      await lockStock(tx, lines.map((l) => l.variantId));
      // ponytail: returns at the cost it left with without re-averaging, like an
      // order cancellation; exact while no COGS is booked (sales-invoice-decisions).
      await tx.insert(StockMovement, lines.map((l) => ({
        variantId: l.variantId, location: 'WAREHOUSE' as const, quantity: l.quantity, reason: 'ADJUSTMENT' as const,
        unitCost: l.unitCost, sourceType: 'sales_invoice', sourceId: id, createdById: userId,
        note: `${invoice.invoiceNumber} voided — ${reason.trim()}`,
      })));
      const [revenue] = await tx.query(
        `SELECT id FROM ledger_entry WHERE source_type = 'sales_invoice' AND source_id = $1 AND kind = 'SALES_INVOICE'
           AND reverses_id IS NULL AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_id = ledger_entry.id)`,
        [id],
      );
      if (revenue) await this.ledger.reverse(revenue.id, userId, tx, reason);
      await tx.update(SalesInvoice, { id }, { status: 'VOID', voidReason: reason.trim(), voidedAt: new Date(), voidedById: userId });
    });
    return this.getInvoice(id);
  }

  private receive(tx: EntityManager, invoice: SalesInvoice, amount: number, memo: string, userId: string, occurredAt?: Date) {
    return this.ledger.post({
      amount: money(amount), debit: 'CASH', credit: 'CUSTOMER_RECEIVABLE', kind: 'CUSTOMER_PAYMENT', occurredAt,
      memo, sourceType: 'sales_invoice', sourceId: invoice.id, actorId: userId,
    }, tx);
  }

  /** One pricing for creating and editing: the typed figure of each line is kept, the other derived. */
  private price(input: SalesInvoiceInput) {
    const lines = input.lines.map((l) => {
      const typedTotal = l.lineTotal !== undefined && l.lineTotal !== '';
      const lineTotal = typedTotal ? Number(l.lineTotal).toFixed(2) : lineTotalFor(l.unitPrice!, l.quantity);
      return {
        variantId: l.variantId,
        quantity: l.quantity,
        unitPrice: typedTotal ? unitCostFor(lineTotal, l.quantity) : l.unitPrice!,
        lineTotal,
        unitCost: null,
      };
    });
    const goodsTotal = round2(lines.reduce((s, l) => s + Number(l.lineTotal), 0));
    const discount = round2(Number(input.discount || 0));
    if (discount > goodsTotal + 0.005) {
      throw new BadRequestException(problem('sales.discountTooLarge', 'the discount cannot exceed the invoice total'));
    }
    return {
      lines,
      header: {
        customerId: input.customerId,
        invoiceDate: input.invoiceDate,
        notes: input.notes?.trim() || null,
        goodsTotal: money(goodsTotal),
        discount: money(discount),
        total: money(round2(goodsTotal - discount)),
      },
    };
  }

  /** Every line's product and the customer must still be active. Locks the products like every stock writer. */
  private async assertUsable(tx: EntityManager, input: Pick<SalesInvoiceInput, 'customerId'> & { lines: Array<{ variantId: string }> }) {
    const wanted = [...new Set(input.lines.map((l) => l.variantId))];
    await lockStock(tx, wanted);
    const variants = await tx.findBy(ProductVariant, { id: In(wanted) });
    if (variants.length !== wanted.length) throw new NotFoundException(problem('notFound', 'a product on this invoice no longer exists'));
    const archived = await archivedProducts(tx, wanted);
    if (archived.length) {
      throw new BadRequestException(problem('invoice.productsGone', 'choose active products for every invoice line', { count: archived.length }, archived));
    }
    const customer = await tx.findOneBy(Customer, { id: input.customerId });
    if (!customer?.active) {
      throw new BadRequestException(problem('sales.customerGone', 'choose an active customer', undefined,
        customer ? [{ kind: 'customer', id: customer.id, label: customer.name }] : undefined));
    }
  }

  /**
   * Everything standing in the way of posting a draft — every short product,
   * every archived one, an archived customer — read by the invoice screen and
   * by `postInvoice` under its locks. `stock` carries each product's warehouse
   * count and cost for the posting itself.
   */
  private async postBlockers(tx: DataSource | EntityManager, customerId: string, lines: Array<{ variantId: string; quantity: number }>) {
    const reasons: Reason[] = [];
    const wanted = new Map<string, number>();
    for (const l of lines) wanted.set(l.variantId, (wanted.get(l.variantId) ?? 0) + l.quantity);
    const ids = [...wanted.keys()];
    const archived = await archivedProducts(tx as EntityManager, ids);
    if (archived.length) reasons.push({ code: 'invoice.productsGone', params: { count: archived.length }, blockers: archived });
    const customer = await tx.getRepository(Customer).findOneBy({ id: customerId });
    if (customer && !customer.active) {
      reasons.push({ code: 'sales.customerGone', blockers: [{ kind: 'customer', id: customer.id, label: customer.name }] });
    }
    // Repeated lines of one product are checked together, against the warehouse only.
    const stock: Array<{ id: string; productId: string; name: string; onHand: number; cost: string | null }> = await tx.query(
      `SELECT v.id, v.product_id AS "productId", CASE WHEN v.name = 'Default' THEN p.name ELSE p.name || ' — ' || v.name END AS name,
              COALESCE((SELECT SUM(m.quantity) FROM stock_movement m
                        WHERE m.variant_id = v.id AND m.location = 'WAREHOUSE'), 0)::int AS "onHand",
              v.unit_cost AS cost
       FROM product_variant v JOIN product p ON p.id = v.product_id
       WHERE v.id = ANY($1::uuid[])`,
      [ids],
    );
    for (const s of stock) {
      const quantity = wanted.get(s.id)!;
      if (quantity > s.onHand) {
        reasons.push({
          code: 'sales.stockShort',
          params: { name: s.name, onHand: s.onHand, requested: quantity },
          blockers: [{ kind: 'product', id: s.productId, label: s.name, count: s.onHand }],
        });
      }
    }
    return { reasons, stock };
  }

  /** A posted invoice is voided only while nothing is collected on it: the payments to reverse first, each linked. */
  private async voidBlockers(tx: DataSource | EntityManager, invoice: SalesInvoice): Promise<Reason[]> {
    if (Number(invoice.paidAmount) <= 0.005) return [];
    const payments: Array<{ id: string; amount: string; date: string }> = await tx.query(
      `SELECT e.id, e.amount, e.occurred_at AS date FROM ledger_entry e
       WHERE e.source_type = 'sales_invoice' AND e.source_id = $1 AND e.kind = 'CUSTOMER_PAYMENT' AND e.reverses_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_id = e.id)
       ORDER BY e.occurred_at`,
      [invoice.id],
    );
    return [{
      code: 'sales.voidPaid',
      params: { paid: money(Number(invoice.paidAmount)) },
      blockers: payments.map((p) => ({ kind: 'customer_payment' as const, id: p.id, parentId: invoice.id, amount: p.amount, date: new Date(p.date).toISOString() })),
    }];
  }

  private validate(input: SalesInvoiceInput) {
    if (input.requestId !== undefined && !UUID.test(input.requestId)) throw new BadRequestException('requestId must be a UUID');
    if (!input.customerId || !UUID.test(input.customerId)) throw new BadRequestException(problem('sales.customerGone', 'choose an active customer'));
    if (!ISO_DATE.test(input.invoiceDate ?? '')) throw new BadRequestException('invoiceDate must be YYYY-MM-DD');
    if (input.discount !== undefined && input.discount !== '' && !MONEY.test(input.discount)) {
      throw new BadRequestException(problem('sales.discount', 'enter a discount like 250.00'));
    }
    if (!Array.isArray(input.lines) || !input.lines.length) {
      throw new BadRequestException(problem('sales.noLines', 'add at least one product'));
    }
    for (const l of input.lines) {
      if (!l?.variantId || !UUID.test(l.variantId)) throw new BadRequestException('every line needs a product');
      if (!Number.isInteger(l.quantity) || l.quantity < 1) {
        throw new BadRequestException(problem('sales.lineQuantity', 'every line needs a whole quantity of at least 1'));
      }
      const typedTotal = l.lineTotal !== undefined && l.lineTotal !== '';
      if (typedTotal ? !MONEY.test(l.lineTotal!) || Number(l.lineTotal) <= 0 : !UNIT_PRICE.test(l.unitPrice ?? '') || Number(l.unitPrice) <= 0) {
        throw new BadRequestException(problem('sales.linePrice', 'every line needs a price greater than 0'));
      }
    }
  }
}
