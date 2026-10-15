import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { ProductVariant } from '../catalog/product-variant.entity';
import { LedgerEntry } from '../finance/ledger-entry.entity';
import { LedgerService } from '../finance/ledger.service';
import { StockMovement } from '../inventory/stock-movement.entity';
import { allocateExtraCosts, allocateOldestFirst, lineTotalFor, movingAverage, round2, unitCostFor } from './costing';
import {
  type CostAllocation,
  paidStatusOf,
  payableTotalOf,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  type PurchasePayment,
} from './purchase-invoice.entity';
import { Supplier } from './supplier.entity';
import { problem, refuse, type Reason } from '../problem';
import { archivedProducts } from '../catalog/product-blockers';
import { lockStock } from '../inventory/stock-lock';
import { isUniqueViolation } from '../database/unique-violation';

const MONEY = /^\d+(\.\d{1,2})?$/;
const UNIT_COST = /^\d+(\.\d{1,4})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (n: number) => n.toFixed(2);

/** A line is typed as quantity × unit cost, or as quantity + line total (which then wins). */
export interface InvoiceLineInput {
  variantId: string;
  quantity: number;
  unitCost?: string;
  lineTotal?: string;
}

export interface CreateInvoiceInput {
  /** The form's submission id; the same id never creates a second invoice. */
  requestId?: string;
  supplierId: string;
  invoiceNo?: string;
  invoiceDate: string;
  payment: PurchasePayment;
  allocation?: CostAllocation;
  extraCosts?: string;
  extraCostsPaidSeparately?: boolean;
  lines: InvoiceLineInput[];
}

@Injectable()
export class PurchasingService {
  private readonly log = new Logger(PurchasingService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly ledger: LedgerService,
  ) {}

  // ── Suppliers ──────────────────────────────────────────────────────────

  /**
   * What a supplier is owed = the unpaid remainder across their posted credit
   * invoices. This is the single source of truth; a payment is capped by it, so
   * the `SUPPLIER_PAYABLE` ledger balance stays in lockstep and the per-invoice
   * status can never contradict the supplier total.
   */
  private async owedBySupplier(
    tx: DataSource | EntityManager = this.db,
  ): Promise<Map<string, number>> {
    const rows: Array<{ supplierId: string; owed: string }> = await tx.query(
      `SELECT supplier_id AS "supplierId",
              COALESCE(SUM(GREATEST(
                CASE WHEN extra_costs_paid_separately THEN goods_total ELSE landed_total END
                - settled_amount, 0
              )), 0) AS owed
       FROM purchase_invoice
       WHERE status = 'POSTED' AND payment = 'CREDIT'
       GROUP BY supplier_id`,
    );
    return new Map(rows.map((r) => [r.supplierId, Number(r.owed)]));
  }

  /** Active suppliers for everyday use; `archived` lists the archived ones instead. */
  async listSuppliers(archived = false) {
    const suppliers = await this.db.getRepository(Supplier).find({
      where: { active: !archived },
      order: { name: 'ASC' },
    });
    const owed = await this.owedBySupplier();
    // What each has billed you — extra costs paid to someone else aren't theirs — on
    // posted invoices, how many, and the latest date.
    const stats: Array<{ supplierId: string; bought: string; invoices: number; lastInvoiceAt: string }> = await this.db.query(
      `SELECT supplier_id AS "supplierId",
              SUM(CASE WHEN extra_costs_paid_separately THEN goods_total ELSE landed_total END) AS bought,
              count(*)::int AS invoices,
              MAX(invoice_date)::text AS "lastInvoiceAt"
       FROM purchase_invoice WHERE status = 'POSTED' GROUP BY supplier_id`,
    );
    const of = new Map(stats.map((r) => [r.supplierId, r]));
    return suppliers.map((s) => ({
      ...s,
      balance: (owed.get(s.id) ?? 0).toFixed(2),
      bought: Number(of.get(s.id)?.bought ?? 0).toFixed(2),
      invoiceCount: of.get(s.id)?.invoices ?? 0,
      lastInvoiceAt: of.get(s.id)?.lastInvoiceAt ?? null,
    }));
  }

  async createSupplier(input: { name: string; phone?: string; note?: string }) {
    if (!input.name?.trim()) throw new BadRequestException(problem('supplier.name', 'enter the supplier name'));
    return this.db.getRepository(Supplier).save({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      note: input.note?.trim() || null,
      active: true,
    });
  }

  /**
   * Edits a supplier's details, or archives / restores it. Archiving hides it
   * from new work but keeps its history, so it is refused while anything is
   * still owed to it or a draft invoice still names it.
   */
  async updateSupplier(id: string, patch: { name?: string; phone?: string | null; note?: string | null; active?: boolean }) {
    return this.db.transaction(async (tx) => {
      const supplier = await tx.findOne(Supplier, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!supplier) throw new NotFoundException(problem('notFound', 'supplier not found'));
      if (patch.name !== undefined) {
        if (!patch.name.trim()) throw new BadRequestException(problem('supplier.name', 'enter the supplier name'));
        supplier.name = patch.name.trim();
      }
      if (patch.phone !== undefined) supplier.phone = patch.phone?.trim() || null;
      if (patch.note !== undefined) supplier.note = patch.note?.trim() || null;
      if (patch.active === false && supplier.active) {
        const blocked = (await this.supplierBlockers(tx, id)).archive;
        if (blocked.length) refuse('supplier.archiveBlocked', 'settle what still depends on this supplier before archiving it', blocked);
      }
      if (patch.active !== undefined) supplier.active = patch.active;
      return tx.save(supplier);
    });
  }

  /**
   * Deletes a supplier entered by mistake. Only one nothing refers to: once it
   * has invoices or payments it is part of the books, and archiving is the way
   * to retire it.
   */
  async deleteSupplier(id: string) {
    await this.db.transaction(async (tx) => {
      const supplier = await tx.findOne(Supplier, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!supplier) throw new NotFoundException(problem('notFound', 'supplier not found'));
      const blocked = (await this.supplierBlockers(tx, id)).delete;
      if (blocked.length) refuse('supplier.deleteBlocked', 'this supplier has invoices or payments — archive it instead', blocked);
      await tx.delete(Supplier, { id });
    });
  }

  /**
   * What stands in the way of deleting or archiving a supplier — read by its
   * screen before anyone clicks, and enforced by both actions with the same
   * reasons. Delete: any invoice or payment makes it part of the books, for
   * good. Archive: money still owed, or draft invoices still naming it.
   */
  private async supplierBlockers(tx: DataSource | EntityManager, id: string): Promise<{ delete: Reason[]; archive: Reason[] }> {
    const invoices: Array<{ id: string; label: string | null; date: string; detail: string; left: string }> = await tx.query(
      `SELECT id, invoice_no AS label, invoice_date::text AS date, status AS detail,
              GREATEST(CASE WHEN extra_costs_paid_separately THEN goods_total ELSE landed_total END - settled_amount, 0)::text AS "left",
              payment
       FROM purchase_invoice WHERE supplier_id = $1 ORDER BY invoice_date DESC, created_at DESC`,
      [id],
    );
    const [{ entries }] = await tx.query('SELECT count(*)::int AS entries FROM ledger_entry WHERE supplier_id = $1', [id]);
    const owed = (await this.owedBySupplier(tx)).get(id) ?? 0;
    const unpaid = invoices.filter((i: { detail: string; left: string; payment?: string }) => i.detail === 'POSTED' && i.payment === 'CREDIT' && Number(i.left) > 0.005);
    const drafts = invoices.filter((i) => i.detail === 'DRAFT');
    const asBlockers = (rows: typeof invoices, amount?: (r: (typeof invoices)[number]) => string) =>
      rows.slice(0, 5).map((r) => ({ kind: 'purchase_invoice' as const, id: r.id, label: r.label ?? undefined, date: r.date, detail: r.detail, amount: amount?.(r) }));
    return {
      delete: [
        ...(invoices.length ? [{ code: 'supplier.hasInvoices', params: { count: invoices.length }, blockers: asBlockers(invoices) }] : []),
        ...(entries ? [{ code: 'supplier.hasPayments', params: { count: entries } }] : []),
      ],
      archive: [
        ...(owed > 0.005 ? [{ code: 'supplier.archiveOwed', params: { owed: money(owed) }, blockers: asBlockers(unpaid, (r) => r.left) }] : []),
        ...(drafts.length ? [{ code: 'supplier.archiveDrafts', params: { count: drafts.length }, blockers: asBlockers(drafts) }] : []),
      ],
    };
  }

  /** A supplier with its invoices and payments — live ones, or with `cancelled` the cancelled too. */
  async supplierDetail(id: string, cancelled = false) {
    const supplier = await this.db.getRepository(Supplier).findOneBy({ id });
    if (!supplier) throw new NotFoundException(problem('notFound', 'supplier not found'));
    const invoices = await this.db.getRepository(PurchaseInvoice).find({
      where: { supplierId: id, ...(cancelled ? {} : { status: Not('VOID' as const) }) },
      order: { invoiceDate: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
    const balance = ((await this.owedBySupplier()).get(id) ?? 0).toFixed(2);
    const payments = await this.ledger.entries({ kind: 'SUPPLIER_PAYMENT', supplierId: id, limit: 100, cancelled });
    return {
      ...supplier,
      blocked: await this.supplierBlockers(this.db, id),
      balance,
      invoices: invoices.map((i) => ({
        ...i,
        payableTotal: payableTotalOf(i).toFixed(2),
        paidStatus: paidStatusOf(i),
      })),
      payments: payments.entries,
    };
  }

  /**
   * Records a payment to a supplier and marks it against their invoices.
   * `invoiceId` settles that one invoice; without it, the oldest unpaid credit
   * invoices first. The amount is capped by what those invoices still owe — so
   * a payment can never be recorded twice, and the `SUPPLIER_PAYABLE` ledger
   * balance stays exactly equal to the sum of unpaid remainders.
   */
  async recordSupplierPayment(
    supplierId: string,
    amount: string,
    memo: string | undefined,
    userId: string,
    invoiceId?: string,
  ) {
    if (!MONEY.test(amount)) throw new BadRequestException('amount must be like 1000.00');
    const value = round2(Number(amount));
    if (value <= 0) throw new BadRequestException(problem('payment.amount', 'enter an amount greater than zero'));

    return this.db.transaction(async (tx) => {
      const supplier = await tx.findOne(Supplier, { where: { id: supplierId }, lock: { mode: 'pessimistic_write' } });
      if (!supplier) throw new NotFoundException(problem('notFound', 'supplier not found'));

      const targets = invoiceId
        ? await tx.find(PurchaseInvoice, {
            where: { id: invoiceId, supplierId, status: 'POSTED', payment: 'CREDIT' },
          })
        : await tx.find(PurchaseInvoice, {
            where: { supplierId, status: 'POSTED', payment: 'CREDIT' },
            order: { invoiceDate: 'ASC', createdAt: 'ASC' },
          });
      if (invoiceId && !targets.length) {
        // Say which state it is in: a draft, a cancelled invoice, or one paid in cash at purchase.
        const target = await tx.findOneBy(PurchaseInvoice, { id: invoiceId, supplierId });
        const state = !target ? 'GONE' : target.status !== 'POSTED' ? target.status : 'CASH';
        throw new BadRequestException(problem('payment.invoiceClosed', 'this invoice cannot take a payment', { state }));
      }

      const owed = round2(
        targets.reduce((s, i) => s + Math.max(0, payableTotalOf(i) - Number(i.settledAmount)), 0),
      );
      const scope = invoiceId ? 'left on this invoice' : `owed to ${supplier.name}`;
      const about = { scope: invoiceId ? 'invoice' : 'supplier', supplier: supplier.name };
      if (owed <= 0.005) throw new BadRequestException(problem('payment.nothingOwed', `nothing is ${scope}`, about));
      if (value > owed + 0.005) {
        throw new BadRequestException(
          problem('payment.overpay', `only ${money(owed)} is ${scope} — you tried to pay ${money(value)}`, {
            ...about,
            owed: money(owed),
            paid: money(value),
          }),
        );
      }

      const applied = allocateOldestFirst(
        targets.map((i) => payableTotalOf(i) - Number(i.settledAmount)),
        value,
      );
      for (const [i, inv] of targets.entries()) {
        if (applied[i] > 0) {
          await tx.update(
            PurchaseInvoice,
            { id: inv.id },
            { settledAmount: money(Number(inv.settledAmount) + applied[i]) },
          );
        }
      }

      const entry = await this.ledger.post(
        {
          amount: money(value),
          debit: 'SUPPLIER_PAYABLE',
          credit: 'CASH',
          kind: 'SUPPLIER_PAYMENT',
          memo: memo?.trim() || `Payment to ${supplier.name}`,
          supplierId,
          sourceType: invoiceId ? 'purchase_invoice' : 'supplier',
          sourceId: invoiceId ?? supplierId,
          actorId: userId,
        },
        tx,
      );
      // Which invoices this payment settled, so reversing it un-settles exactly those.
      for (const [i, inv] of targets.entries()) {
        if (applied[i] > 0) {
          await tx.query(
            'INSERT INTO supplier_payment_allocation (ledger_entry_id, invoice_id, amount) VALUES ($1, $2, $3)',
            [entry.id, inv.id, money(applied[i])],
          );
        }
      }
      return entry;
    });
  }

  /**
   * Reverses a supplier payment recorded by mistake: the cash comes back, the
   * invoices it settled are owed again, and the reason and who did it are kept
   * on the reversal. Serialized with new payments by the supplier lock;
   * reversing it again changes nothing.
   *
   * ponytail: a payment recorded before allocations were kept un-settles the
   * invoice it named first, then the newest settled invoices — the supplier's
   * total is exact either way, but which invoice reads as unpaid may differ
   * from the day it was paid.
   */
  async reverseSupplierPayment(supplierId: string, entryId: string, reason: string, userId: string) {
    if (!reason?.trim() || reason.trim().length > 1000) {
      throw new BadRequestException(problem('payment.reason', 'write why this payment is reversed'));
    }
    return this.db.transaction(async (tx) => {
      const supplier = await tx.findOne(Supplier, { where: { id: supplierId }, lock: { mode: 'pessimistic_write' } });
      if (!supplier) throw new NotFoundException(problem('notFound', 'supplier not found'));
      const entry = await tx.findOne(LedgerEntry, { where: { id: entryId }, lock: { mode: 'pessimistic_write' } });
      if (!entry || entry.kind !== 'SUPPLIER_PAYMENT' || entry.supplierId !== supplierId || entry.reversesId) {
        throw new NotFoundException(problem('notFound', 'payment not found'));
      }
      const earlier = await tx.findOneBy(LedgerEntry, { reversesId: entryId });
      if (earlier) return earlier;

      const allocated: Array<{ invoiceId: string; amount: string }> = await tx.query(
        'SELECT invoice_id AS "invoiceId", amount FROM supplier_payment_allocation WHERE ledger_entry_id = $1',
        [entryId],
      );
      const undo = allocated.length
        ? allocated.map((a) => ({ invoiceId: a.invoiceId, amount: Number(a.amount) }))
        : await this.legacyAllocation(tx, entry);
      for (const u of undo) {
        const invoice = await tx.findOne(PurchaseInvoice, { where: { id: u.invoiceId }, lock: { mode: 'pessimistic_write' } });
        const left = round2(Number(invoice?.settledAmount ?? 0) - u.amount);
        if (!invoice || left < -0.005) {
          throw new BadRequestException(problem('payment.cannotReverse', 'this payment no longer matches its invoices and cannot be reversed automatically'));
        }
        await tx.update(PurchaseInvoice, { id: u.invoiceId }, { settledAmount: money(Math.max(left, 0)) });
      }
      return this.ledger.reverse(entryId, userId, tx, reason);
    });
  }

  /** For a payment recorded before allocations were kept: the invoice it named, then the newest settled ones. */
  private async legacyAllocation(tx: EntityManager, entry: LedgerEntry) {
    const invoices = await tx.find(PurchaseInvoice, {
      where: { supplierId: entry.supplierId!, status: 'POSTED', payment: 'CREDIT' },
      order: { invoiceDate: 'DESC', createdAt: 'DESC' },
    });
    if (entry.sourceType === 'purchase_invoice') {
      invoices.sort((a, b) => Number(b.id === entry.sourceId) - Number(a.id === entry.sourceId));
    }
    let left = Number(entry.amount);
    const undo: Array<{ invoiceId: string; amount: number }> = [];
    for (const inv of invoices) {
      const take = round2(Math.min(Number(inv.settledAmount), left));
      if (take > 0) undo.push({ invoiceId: inv.id, amount: take });
      left = round2(left - take);
      if (left <= 0.005) break;
    }
    if (left > 0.005) {
      throw new BadRequestException(problem('payment.cannotReverse', 'this payment no longer matches its invoices and cannot be reversed automatically'));
    }
    return undo;
  }

  // ── Purchase invoices ──────────────────────────────────────────────────

  /** Live invoices; `cancelled` brings the cancelled ones back. */
  async listInvoices(cancelled = false) {
    const rows = await this.db.query(
      `SELECT i.id, i.invoice_no AS "invoiceNo", i.invoice_date AS "invoiceDate",
              i.status, i.payment, i.goods_total AS "goodsTotal",
              i.extra_costs AS "extraCosts", i.landed_total AS "landedTotal",
              i.extra_costs_paid_separately AS "extraCostsPaidSeparately",
              i.settled_amount AS "settledAmount",
              i.posted_at AS "postedAt", s.name AS "supplierName",
              (SELECT count(*)::int FROM purchase_invoice_line l WHERE l.invoice_id = i.id) AS "lineCount"
       FROM purchase_invoice i
       JOIN supplier s ON s.id = i.supplier_id
       ${cancelled ? '' : "WHERE i.status <> 'VOID'"}
       ORDER BY i.invoice_date DESC, i.created_at DESC
       LIMIT 100`,
    );
    return rows.map((r: Parameters<typeof paidStatusOf>[0]) => ({
      ...r,
      payableTotal: payableTotalOf(r).toFixed(2),
      paidStatus: paidStatusOf(r),
    }));
  }

  async getInvoice(id: string) {
    const invoice = await this.db.getRepository(PurchaseInvoice).findOne({
      where: { id },
      relations: { supplier: true },
    });
    if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
    const lines = await this.db.query(
      `SELECT l.id, l.variant_id AS "variantId", l.quantity, l.unit_cost AS "unitCost",
              l.landed_unit_cost AS "landedUnitCost", l.line_total AS "lineTotal",
              CASE WHEN v.name = 'Default' THEN p.name ELSE p.name || ' — ' || v.name END AS label
       FROM purchase_invoice_line l
       JOIN product_variant v ON v.id = l.variant_id
       JOIN product p ON p.id = v.product_id
       WHERE l.invoice_id = $1
       ORDER BY p.name`,
      [id],
    );
    const [audit] = await this.db.query(
      `SELECT (SELECT name FROM app_user WHERE id = $2) AS "voidedBy",
              (SELECT id FROM purchase_invoice WHERE replaces_id = $1 LIMIT 1) AS "replacedById"`,
      [id, invoice.voidedById],
    );
    return {
      ...invoice,
      ...audit,
      blocked: { cancel: invoice.status === 'POSTED' ? (await this.cancelBlockers(this.db, invoice)).reasons : [] },
      payableTotal: payableTotalOf(invoice).toFixed(2),
      paidStatus: paidStatusOf(invoice),
      lines,
    };
  }

  /** Creates a DRAFT invoice — no stock or money moves until it is posted. */
  async createInvoice(input: CreateInvoiceInput, userId: string, postImmediately = false) {
    this.validateInvoiceInput(input);
    const requestId = input.requestId || null;
    const earlier = requestId ? await this.db.getRepository(PurchaseInvoice).findOneBy({ requestId }) : null;
    if (earlier) return this.getInvoice(earlier.id);

    const { lines, header } = this.priceInvoice(input);

    // A concurrent resend of the same request waits on the unique key, then gets the first invoice.
    const invoiceId = await this.db.transaction(async (tx) => {
      await this.assertUsable(tx, input);
      const invoice = await tx.save(PurchaseInvoice, {
        requestId,
        ...header,
        status: 'DRAFT' as const,
        createdById: userId,
      });
      await tx.insert(
        PurchaseInvoiceLine,
        lines.map((l) => ({ ...l, invoiceId: invoice.id })),
      );
      if (postImmediately) await this.postInvoiceInTransaction(tx, invoice.id, userId);
      return invoice.id;
    }).catch(async (error: unknown) => {
      const first = requestId && isUniqueViolation(error, 'uq_purchase_invoice_request')
        ? await this.db.getRepository(PurchaseInvoice).findOneBy({ requestId })
        : null;
      if (!first) throw error;
      return first.id;
    });
    return this.getInvoice(invoiceId);
  }

  /**
   * Rewrites a draft — header and lines — exactly as `createInvoice` would
   * build it. A draft moves no stock or money, so editing it changes nothing
   * else; a posted invoice is refused.
   */
  async updateDraft(id: string, input: CreateInvoiceInput) {
    this.validateInvoiceInput(input);
    const { lines, header } = this.priceInvoice(input);
    await this.db.transaction(async (tx) => {
      const invoice = await tx.findOne(PurchaseInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      if (invoice.status !== 'DRAFT') {
        throw new BadRequestException(problem('invoice.postedEdit', 'a posted invoice cannot be edited'));
      }
      await this.assertUsable(tx, input);
      await tx.update(PurchaseInvoice, { id }, header);
      await tx.delete(PurchaseInvoiceLine, { invoiceId: id });
      await tx.insert(PurchaseInvoiceLine, lines.map((l) => ({ ...l, invoiceId: id })));
    });
    return this.getInvoice(id);
  }

  /** One pricing for creating and editing: whichever of unit cost or line total was typed is kept, the other derived. */
  private priceInvoice(input: CreateInvoiceInput) {
    const lines = input.lines.map((l) => {
      const typedTotal = l.lineTotal !== undefined && l.lineTotal !== '';
      const lineTotal = typedTotal ? Number(l.lineTotal).toFixed(2) : lineTotalFor(l.unitCost!, l.quantity);
      return {
        variantId: l.variantId,
        quantity: l.quantity,
        unitCost: typedTotal ? unitCostFor(lineTotal, l.quantity) : l.unitCost!,
        lineTotal,
        landedUnitCost: null,
      };
    });
    const goodsTotal = round2(lines.reduce((s, l) => s + Number(l.lineTotal), 0));
    const extraCosts = round2(Number(input.extraCosts ?? 0));
    return {
      lines,
      header: {
        supplierId: input.supplierId,
        invoiceNo: input.invoiceNo?.trim() || null,
        invoiceDate: input.invoiceDate,
        payment: input.payment,
        allocation: input.allocation ?? 'BY_VALUE',
        goodsTotal: goodsTotal.toFixed(2),
        extraCosts: extraCosts.toFixed(2),
        extraCostsPaidSeparately: input.extraCostsPaidSeparately ?? false,
        landedTotal: round2(goodsTotal + extraCosts).toFixed(2),
      },
    };
  }

  /** Every line's product and the supplier must still be active. Locks the products like every stock writer. */
  private async assertUsable(tx: EntityManager, input: CreateInvoiceInput) {
    const wanted = [...new Set(input.lines.map((l) => l.variantId))];
    await lockStock(tx, wanted);
    const variants = await tx.findBy(ProductVariant, { id: In(wanted) });
    if (variants.length !== wanted.length) throw new NotFoundException(problem('notFound', 'a product on this invoice no longer exists'));
    const archived = await archivedProducts(tx, wanted);
    if (archived.length) {
      throw new BadRequestException(problem('invoice.productsGone', 'choose active products for every invoice line', { count: archived.length }, archived));
    }
    const supplier = await tx.findOneBy(Supplier, { id: input.supplierId });
    if (!supplier?.active) {
      throw new BadRequestException(problem('invoice.supplierGone', 'choose an active supplier', undefined,
        supplier ? [{ kind: 'supplier', id: supplier.id, label: supplier.name }] : undefined));
    }
  }

  async deleteDraft(id: string) {
    await this.db.transaction(async (tx) => {
      const invoice = await tx.findOne(PurchaseInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      if (invoice.status !== 'DRAFT') {
        throw new BadRequestException(problem('invoice.postedDelete', 'a posted invoice cannot be deleted'));
      }
      await tx.delete(PurchaseInvoice, { id });
    });
  }

  /**
   * Posts a draft: allocates extra costs across the lines, receives each line
   * into stock at its landed cost, rolls the variant's moving-average cost
   * forward, and books one `INVENTORY ← CASH / SUPPLIER_PAYABLE` entry.
   */
  async postInvoice(id: string, userId: string) {
    await this.db.transaction((tx) => this.postInvoiceInTransaction(tx, id, userId));
    return this.getInvoice(id);
  }

  private async postInvoiceInTransaction(tx: EntityManager, id: string, userId: string) {
      const invoice = await tx.findOne(PurchaseInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      if (invoice.status === 'POSTED') throw new BadRequestException(problem('invoice.posted', 'this invoice is already posted'));
      invoice.lines = await tx.find(PurchaseInvoiceLine, { where: { invoiceId: id }, order: { id: 'ASC' } });
      await lockStock(tx, invoice.lines.map((l) => l.variantId));
      if (!invoice.lines.length) throw new BadRequestException(problem('invoice.noLines', 'add at least one line before posting'));
      const archived = await archivedProducts(tx, invoice.lines.map((line) => line.variantId));
      if (archived.length) {
        throw new BadRequestException(problem('invoice.productsGone', 'choose active products for every invoice line', { count: archived.length }, archived));
      }

      const shares = allocateExtraCosts(
        invoice.lines.map((l) => ({ lineTotal: Number(l.lineTotal), quantity: l.quantity })),
        Number(invoice.extraCosts),
        invoice.allocation,
      );

      for (const [i, line] of invoice.lines.entries()) {
        const landedLineTotal = round2(Number(line.lineTotal) + shares[i]);
        const landedUnitCost = landedLineTotal / line.quantity;

        const [{ onHand, avg }] = await tx.query(
          `SELECT COALESCE(SUM(m.quantity), 0)::int AS "onHand", v.unit_cost AS avg
           FROM product_variant v
           LEFT JOIN stock_movement m ON m.variant_id = v.id
           WHERE v.id = $1 GROUP BY v.unit_cost`,
          [line.variantId],
        );
        const newAvg = movingAverage(
          Number(onHand),
          avg === null ? null : Number(avg),
          line.quantity,
          landedUnitCost,
        );

        await tx.insert(StockMovement, {
          variantId: line.variantId,
          quantity: line.quantity,
          reason: 'PURCHASE',
          unitCost: landedUnitCost.toFixed(4),
          avgCostAfter: newAvg.toFixed(4),
          sourceType: 'purchase_invoice',
          sourceId: invoice.id,
          createdById: userId,
          occurredAt: new Date(`${invoice.invoiceDate}T00:00:00Z`),
        });
        await tx.update(ProductVariant, { id: line.variantId }, { unitCost: newAvg.toFixed(4) });
        await tx.update(PurchaseInvoiceLine, { id: line.id }, { landedUnitCost: landedUnitCost.toFixed(4) });
      }

      await this.ledger.post(
        {
          amount: invoice.extraCostsPaidSeparately ? invoice.goodsTotal : invoice.landedTotal,
          debit: 'INVENTORY',
          credit: invoice.payment === 'CASH' ? 'CASH' : 'SUPPLIER_PAYABLE',
          kind: 'PURCHASE',
          occurredAt: new Date(`${invoice.invoiceDate}T00:00:00Z`),
          memo: `Purchase invoice${invoice.invoiceNo ? ` ${invoice.invoiceNo}` : ''}`,
          supplierId: invoice.payment === 'CREDIT' ? invoice.supplierId : null,
          sourceType: 'purchase_invoice',
          sourceId: invoice.id,
          actorId: userId,
        },
        tx,
      );

      if (invoice.extraCostsPaidSeparately && Number(invoice.extraCosts) > 0) {
        await this.ledger.post({ amount: invoice.extraCosts, debit: 'INVENTORY', credit: 'CASH', kind: 'PURCHASE',
          sourceType: 'purchase_invoice', sourceId: invoice.id, actorId: userId,
          occurredAt: new Date(`${invoice.invoiceDate}T00:00:00Z`), memo: 'Landed costs paid separately' }, tx);
      }
      await tx.update(
        PurchaseInvoice,
        { id },
        {
          status: 'POSTED',
          postedAt: new Date(),
          // A cash invoice is paid the moment it posts.
          settledAmount: invoice.payment === 'CASH'
            ? (invoice.extraCostsPaidSeparately ? invoice.goodsTotal : invoice.landedTotal)
            : '0',
        },
      );
      this.log.log(`purchase invoice ${id} posted: ${invoice.lines.length} lines, ${invoice.landedTotal}`);
  }

  /**
   * Cancels a posted invoice entered by mistake, as if it had never been
   * posted — and only when that is exactly possible:
   *   - nothing is paid on it (a credit invoice's payments are reversed first;
   *     a cash invoice's cash simply comes back with it);
   *   - none of its products has moved since it was posted — no sale, count,
   *     transfer, cost correction or later purchase — so taking its goods out
   *     restores the stock and the average cost they had. Enough stock on hand
   *     is not enough: goods that moved since were costed with this invoice in
   *     the average, and cancelling would leave that wrong;
   *   - its goods are still in the warehouse.
   * A refusal names what blocks it. `correct` re-enters the invoice as a new
   * draft (`replacesId`) to fix and post again. A resend returns the same result.
   */
  async voidInvoice(id: string, reason: string, userId: string, correct = false) {
    if (!reason?.trim() || reason.trim().length > 1000) {
      throw new BadRequestException(problem('invoice.cancelReason', 'write why this invoice is cancelled'));
    }
    return this.db.transaction(async (tx) => {
      const found = await tx.findOneBy(PurchaseInvoice, { id });
      if (!found) throw new NotFoundException(problem('notFound', 'invoice not found'));
      // The supplier lock serializes this with payments, which settle its invoices.
      await tx.findOne(Supplier, { where: { id: found.supplierId }, lock: { mode: 'pessimistic_write' } });
      const invoice = await tx.findOne(PurchaseInvoice, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!invoice) throw new NotFoundException(problem('notFound', 'invoice not found'));
      if (invoice.status === 'VOID') {
        const draft = await tx.findOneBy(PurchaseInvoice, { replacesId: id });
        return { id, draftId: draft?.id ?? (correct ? await this.reenter(tx, invoice, userId) : null) };
      }
      const { reasons, ours, firstSeq } = await this.cancelBlockers(tx, invoice, true);
      if (reasons.length) refuse('invoice.cancelBlocked', 'this invoice cannot be cancelled as if it were never posted', reasons);

      const byVariant = new Map<string, { quantity: number; value: number; name: string }>();
      for (const m of ours) {
        const v = byVariant.get(m.variantId) ?? { quantity: 0, value: 0, name: m.name };
        v.quantity += m.quantity;
        v.value += m.quantity * Number(m.unitCost);
        byVariant.set(m.variantId, v);
      }
      const label = `Purchase invoice${invoice.invoiceNo ? ` ${invoice.invoiceNo}` : ''} cancelled — ${reason.trim()}`;
      for (const [variantId, v] of byVariant) {
        const [{ onHand, warehouse, avg }] = await tx.query(
          `SELECT COALESCE(SUM(m.quantity), 0)::int AS "onHand",
                  COALESCE(SUM(m.quantity) FILTER (WHERE m.location = 'WAREHOUSE'), 0)::int AS warehouse,
                  (SELECT unit_cost FROM product_variant WHERE id = $1) AS avg
           FROM stock_movement m WHERE m.variant_id = $1`,
          [variantId],
        );
        if (warehouse < v.quantity) throw new BadRequestException(problem('invoice.cancelStock', 'stock changed while cancelling', { name: v.name, onHand: warehouse, requested: v.quantity }));
        // The average before this invoice: exact by arithmetic while stock remains;
        // with none left, the last average recorded before it.
        const before = onHand - v.quantity;
        let cost: string | null;
        if (before > 0) {
          cost = Math.max((onHand * Number(avg) - v.value) / before, 0).toFixed(4);
        } else {
          const [prev] = await tx.query(
            `SELECT avg_cost_after AS cost FROM stock_movement
             WHERE variant_id = $1 AND avg_cost_after IS NOT NULL AND seq < $2::bigint
             ORDER BY seq DESC LIMIT 1`,
            [variantId, firstSeq],
          );
          cost = prev?.cost ?? avg;
        }
        await tx.insert(StockMovement, {
          variantId, location: 'WAREHOUSE', quantity: -v.quantity, reason: 'ADJUSTMENT',
          unitCost: (v.value / v.quantity).toFixed(4), avgCostAfter: cost,
          sourceType: 'purchase_invoice', sourceId: id, createdById: userId, note: label,
        });
        await tx.update(ProductVariant, { id: variantId }, { unitCost: cost });
      }

      const entries: Array<{ id: string }> = await tx.query(
        `SELECT e.id FROM ledger_entry e
         WHERE e.source_type = 'purchase_invoice' AND e.source_id = $1 AND e.kind = 'PURCHASE' AND e.reverses_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_id = e.id)`,
        [id],
      );
      for (const e of entries) await this.ledger.reverse(e.id, userId, tx, reason);

      await tx.update(PurchaseInvoice, { id }, {
        status: 'VOID', voidedAt: new Date(), voidedById: userId, voidReason: reason.trim(), settledAmount: '0',
      });
      this.log.log(`purchase invoice ${id} cancelled`);
      return { id, draftId: correct ? await this.reenter(tx, invoice, userId) : null };
    });
  }

  /**
   * Everything standing in the way of cancelling (or editing) a posted invoice,
   * each with the records involved — read by the invoice screen before anyone
   * clicks, and by `voidInvoice` under its locks (`locked`), so the answer on
   * screen and the answer at submit are the same rule.
   */
  private async cancelBlockers(tx: DataSource | EntityManager, invoice: PurchaseInvoice, locked = false) {
    const reasons: Reason[] = [];
    if (invoice.status === 'DRAFT') reasons.push({ code: 'invoice.cancelDraft' });
    if (invoice.status !== 'POSTED') return { reasons, ours: [], firstSeq: '0' };

    if (invoice.payment === 'CREDIT' && Number(invoice.settledAmount) > 0.005) {
      const payments: Array<{ id: string; amount: string; date: string }> = await tx.query(
        `SELECT e.id, a.amount, e.occurred_at AS date
         FROM supplier_payment_allocation a JOIN ledger_entry e ON e.id = a.ledger_entry_id
         WHERE a.invoice_id = $1 AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_id = e.id)
         UNION ALL
         SELECT e.id, e.amount, e.occurred_at FROM ledger_entry e
         WHERE e.kind = 'SUPPLIER_PAYMENT' AND e.source_type = 'purchase_invoice' AND e.source_id = $1::text
           AND e.reverses_id IS NULL AND NOT EXISTS (SELECT 1 FROM ledger_entry r WHERE r.reverses_id = e.id)
           AND NOT EXISTS (SELECT 1 FROM supplier_payment_allocation a WHERE a.ledger_entry_id = e.id)
         ORDER BY date`,
        [invoice.id],
      );
      reasons.push({
        code: 'invoice.cancelPaid',
        params: { paid: money(Number(invoice.settledAmount)) },
        // A payment from before allocations were kept can't be pinned to one
        // invoice: the supplier's page, where payments are reversed, stands in.
        blockers: payments.length
          ? payments.map((p) => ({ kind: 'supplier_payment' as const, id: p.id, parentId: invoice.supplierId, amount: p.amount, date: new Date(p.date).toISOString() }))
          : [{ kind: 'supplier' as const, id: invoice.supplierId }],
      });
    }

    const ours: Array<{ variantId: string; quantity: number; unitCost: string; seq: string; name: string; productId: string }> =
      await tx.query(
        `SELECT m.variant_id AS "variantId", m.quantity, m.unit_cost AS "unitCost", m.seq, v.product_id AS "productId",
                CASE WHEN v.name = 'Default' THEN p.name ELSE p.name || ' — ' || v.name END AS name
         FROM stock_movement m JOIN product_variant v ON v.id = m.variant_id JOIN product p ON p.id = v.product_id
         WHERE m.source_type = 'purchase_invoice' AND m.source_id = $1 AND m.quantity > 0
         ORDER BY m.seq`,
        [invoice.id],
      );
    const variantIds = [...new Set(ours.map((m) => m.variantId))];
    if (locked) await lockStock(tx as EntityManager, variantIds);
    const firstSeq = ours[0]?.seq ?? '0';

    // Anything written for these products after this invoice's own rows: the
    // product, what happened to it, and the order or invoice that did it.
    const moved: Array<{ productId: string; name: string; reason: string; sourceType: string | null; sourceId: string | null }> = await tx.query(
      `SELECT DISTINCT ON (m.variant_id) v.product_id AS "productId", m.reason, m.source_type AS "sourceType", m.source_id AS "sourceId",
              CASE WHEN v.name = 'Default' THEN p.name ELSE p.name || ' — ' || v.name END AS name
       FROM stock_movement m JOIN product_variant v ON v.id = m.variant_id JOIN product p ON p.id = v.product_id
       WHERE m.variant_id = ANY($1::uuid[]) AND m.seq > $2::bigint
         AND NOT (m.source_type IS NOT DISTINCT FROM 'purchase_invoice' AND m.source_id IS NOT DISTINCT FROM $3)
       ORDER BY m.variant_id, m.seq`,
      [variantIds, firstSeq, invoice.id],
    );
    if (moved.length) {
      const documents = await this.documentsOf(tx, moved);
      reasons.push({
        code: 'invoice.cancelMoved',
        params: { count: moved.length },
        blockers: [
          ...moved.map((m) => ({ kind: 'product' as const, id: m.productId, label: m.name, detail: m.reason })),
          ...documents,
        ],
      });
    }

    const wanted = new Map<string, { quantity: number; name: string; productId: string }>();
    for (const m of ours) {
      const w = wanted.get(m.variantId) ?? { quantity: 0, name: m.name, productId: m.productId };
      w.quantity += m.quantity;
      wanted.set(m.variantId, w);
    }
    for (const [variantId, w] of wanted) {
      const [{ warehouse }] = await tx.query(
        `SELECT COALESCE(SUM(quantity), 0)::int AS warehouse FROM stock_movement WHERE variant_id = $1 AND location = 'WAREHOUSE'`,
        [variantId],
      );
      if (warehouse < w.quantity) {
        reasons.push({
          code: 'invoice.cancelStock',
          params: { name: w.name, onHand: warehouse, requested: w.quantity },
          blockers: [{ kind: 'product', id: w.productId, label: w.name, count: warehouse }],
        });
      }
    }
    return { reasons, ours, firstSeq };
  }

  /** The orders and invoices behind some stock movements, named and linked. */
  private async documentsOf(tx: DataSource | EntityManager, moves: Array<{ sourceType: string | null; sourceId: string | null }>) {
    const ids = (type: string) => [...new Set(moves.filter((m) => m.sourceType === type && m.sourceId).map((m) => m.sourceId!))];
    const [orders, sales, purchases] = await Promise.all([
      ids('order').length
        ? tx.query('SELECT id, order_number AS label FROM customer_order WHERE id = ANY($1::uuid[])', [ids('order')])
        : [],
      ids('sales_invoice').length
        ? tx.query('SELECT id, invoice_number AS label FROM sales_invoice WHERE id = ANY($1::uuid[])', [ids('sales_invoice')])
        : [],
      ids('purchase_invoice').length
        ? tx.query('SELECT id, invoice_no AS label FROM purchase_invoice WHERE id = ANY($1::uuid[])', [ids('purchase_invoice')])
        : [],
    ]);
    return [
      ...orders.map((o: { id: string; label: string }) => ({ kind: 'order' as const, id: o.id, label: o.label })),
      ...sales.map((o: { id: string; label: string | null }) => ({ kind: 'sales_invoice' as const, id: o.id, label: o.label ?? undefined })),
      ...purchases.map((o: { id: string; label: string | null }) => ({ kind: 'purchase_invoice' as const, id: o.id, label: o.label ?? undefined })),
    ].slice(0, 5);
  }

  /** The cancelled invoice again, as a draft to fix and post — pointing back at the one it replaces. */
  private async reenter(tx: EntityManager, invoice: PurchaseInvoice, userId: string) {
    const lines = await tx.find(PurchaseInvoiceLine, { where: { invoiceId: invoice.id }, order: { id: 'ASC' } });
    const draft = await tx.save(PurchaseInvoice, {
      supplierId: invoice.supplierId, invoiceNo: invoice.invoiceNo, invoiceDate: invoice.invoiceDate,
      status: 'DRAFT' as const, payment: invoice.payment, goodsTotal: invoice.goodsTotal, extraCosts: invoice.extraCosts,
      extraCostsPaidSeparately: invoice.extraCostsPaidSeparately, allocation: invoice.allocation,
      landedTotal: invoice.landedTotal, settledAmount: '0', replacesId: invoice.id, createdById: userId,
    });
    await tx.insert(PurchaseInvoiceLine, lines.map((l) => ({
      invoiceId: draft.id, variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost, lineTotal: l.lineTotal,
    })));
    return draft.id;
  }

  private validateInvoiceInput(input: CreateInvoiceInput) {
    if (input.allocation !== undefined && !['BY_VALUE', 'PER_UNIT'].includes(input.allocation)) throw new BadRequestException(problem('invoice.allocation', 'choose a supported allocation method'));
    if (input.extraCostsPaidSeparately !== undefined && typeof input.extraCostsPaidSeparately !== 'boolean') throw new BadRequestException('invalid cost payment');
    if (input.requestId !== undefined && !UUID.test(input.requestId)) throw new BadRequestException('requestId must be a UUID');
    if (!input.supplierId) throw new BadRequestException(problem('invoice.chooseSupplier', 'choose a supplier'));
    if (!ISO_DATE.test(input.invoiceDate ?? '')) throw new BadRequestException('invoiceDate must be YYYY-MM-DD');
    if (input.payment !== 'CASH' && input.payment !== 'CREDIT') {
      throw new BadRequestException('payment must be CASH or CREDIT');
    }
    if (input.extraCosts !== undefined && input.extraCosts !== '' && !MONEY.test(input.extraCosts)) {
      throw new BadRequestException(problem('invoice.extraCosts', 'enter extra costs like 5000.00'));
    }
    if (!input.lines?.length) throw new BadRequestException(problem('invoice.noLines', 'add at least one line'));
    for (const l of input.lines) {
      if (!l.variantId) throw new BadRequestException(problem('invoice.lineProduct', 'every line needs a product'));
      if (!Number.isInteger(l.quantity) || l.quantity < 1) {
        throw new BadRequestException(problem('invoice.lineQuantity', 'every line needs a whole quantity of at least 1'));
      }
      const typedTotal = l.lineTotal !== undefined && l.lineTotal !== '';
      if (typedTotal ? !MONEY.test(l.lineTotal!) || Number(l.lineTotal) <= 0 : !UNIT_COST.test(l.unitCost ?? '') || Number(l.unitCost) <= 0) {
        throw new BadRequestException(problem('invoice.lineCost', 'every line needs a unit cost greater than 0'));
      }
    }
  }
}
