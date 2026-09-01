import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { ProductVariant } from '../catalog/product-variant.entity';
import { LedgerService } from '../finance/ledger.service';
import { StockMovement } from '../inventory/stock-movement.entity';
import { allocateExtraCosts, movingAverage, round2, round4 } from './costing';
import {
  type CostAllocation,
  paidStatusOf,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  type PurchasePayment,
} from './purchase-invoice.entity';
import { Supplier } from './supplier.entity';

const MONEY = /^\d+(\.\d{1,2})?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const money = (n: number) => n.toFixed(2);

export interface InvoiceLineInput {
  variantId: string;
  quantity: number;
  unitCost: string;
}

export interface CreateInvoiceInput {
  supplierId: string;
  invoiceNo?: string;
  invoiceDate: string;
  payment: PurchasePayment;
  allocation?: CostAllocation;
  extraCosts?: string;
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

  async listSuppliers() {
    const suppliers = await this.db.getRepository(Supplier).find({
      where: { active: true },
      order: { name: 'ASC' },
    });
    const owed = await this.db.query(
      `SELECT e.supplier_id AS "supplierId",
              COALESCE(SUM(CASE WHEN e.credit_code = 'SUPPLIER_PAYABLE' THEN e.amount
                                WHEN e.debit_code  = 'SUPPLIER_PAYABLE' THEN -e.amount
                                ELSE 0 END), 0) AS balance
       FROM ledger_entry e
       WHERE e.supplier_id IS NOT NULL
       GROUP BY e.supplier_id`,
    );
    const byId = new Map<string, string>(owed.map((r: { supplierId: string; balance: string }) => [r.supplierId, r.balance]));
    return suppliers.map((s) => ({ ...s, balance: Number(byId.get(s.id) ?? 0).toFixed(2) }));
  }

  async createSupplier(input: { name: string; phone?: string; note?: string }) {
    if (!input.name?.trim()) throw new BadRequestException('supplier name is required');
    return this.db.getRepository(Supplier).save({
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      note: input.note?.trim() || null,
      active: true,
    });
  }

  async updateSupplier(id: string, patch: { name?: string; phone?: string | null; note?: string | null; active?: boolean }) {
    const repo = this.db.getRepository(Supplier);
    const supplier = await repo.findOneBy({ id });
    if (!supplier) throw new NotFoundException('supplier not found');
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new BadRequestException('name cannot be empty');
      supplier.name = patch.name.trim();
    }
    if (patch.phone !== undefined) supplier.phone = patch.phone?.trim() || null;
    if (patch.note !== undefined) supplier.note = patch.note?.trim() || null;
    if (patch.active !== undefined) supplier.active = patch.active;
    return repo.save(supplier);
  }

  async supplierDetail(id: string) {
    const supplier = await this.db.getRepository(Supplier).findOneBy({ id });
    if (!supplier) throw new NotFoundException('supplier not found');
    const balance = await this.ledger.balanceOf('SUPPLIER_PAYABLE', { supplierId: id });
    const invoices = await this.db.getRepository(PurchaseInvoice).find({
      where: { supplierId: id },
      order: { invoiceDate: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
    const payments = await this.ledger.entries({ kind: 'SUPPLIER_PAYMENT', supplierId: id, limit: 100 });
    return {
      ...supplier,
      balance,
      invoices: invoices.map((i) => ({ ...i, paidStatus: paidStatusOf(i) })),
      payments: payments.entries,
    };
  }

  /**
   * Records a payment to a supplier and marks it against their invoices.
   * `invoiceId` pays one invoice; without it the money pays down the oldest
   * unpaid credit invoices first. Either way it can never exceed what is owed —
   * that is the guard against recording the same payment twice.
   */
  async recordSupplierPayment(
    supplierId: string,
    amount: string,
    memo: string | undefined,
    userId: string,
    invoiceId?: string,
  ) {
    if (!MONEY.test(amount)) throw new BadRequestException('amount must be like 1000.00');
    const value = Number(amount);
    if (value <= 0) throw new BadRequestException('amount must be greater than zero');

    return this.db.transaction(async (tx) => {
      const supplier = await tx.findOneBy(Supplier, { id: supplierId });
      if (!supplier) throw new NotFoundException('supplier not found');

      const outstanding = Number(
        await this.ledger.balanceOf('SUPPLIER_PAYABLE', { supplierId }, tx),
      );
      if (outstanding <= 0) {
        throw new BadRequestException(`nothing is owed to ${supplier.name}`);
      }
      if (value > outstanding + 0.005) {
        throw new BadRequestException(
          `only ${money(outstanding)} is owed to ${supplier.name} — cannot pay ${money(value)}`,
        );
      }

      // Decide which invoice(s) this payment settles.
      const targets = invoiceId
        ? await tx.find(PurchaseInvoice, { where: { id: invoiceId, supplierId } })
        : await tx.find(PurchaseInvoice, {
            where: { supplierId, status: 'POSTED', payment: 'CREDIT' },
            order: { invoiceDate: 'ASC', createdAt: 'ASC' },
          });
      if (invoiceId && !targets.length) throw new NotFoundException('invoice not found');

      let left = value;
      for (const inv of targets) {
        if (left <= 0.005) break;
        const remaining = Number(inv.landedTotal) - Number(inv.settledAmount);
        if (remaining <= 0.005) continue;
        const apply = Math.min(left, remaining);
        await tx.update(
          PurchaseInvoice,
          { id: inv.id },
          { settledAmount: money(Number(inv.settledAmount) + apply) },
        );
        left -= apply;
      }
      if (invoiceId && left > 0.005) {
        const inv = targets[0];
        throw new BadRequestException(
          `only ${money(Number(inv.landedTotal) - Number(inv.settledAmount))} is left on this invoice`,
        );
      }

      return this.ledger.post(
        {
          amount,
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
    });
  }

  // ── Purchase invoices ──────────────────────────────────────────────────

  async listInvoices() {
    const rows = await this.db.query(
      `SELECT i.id, i.invoice_no AS "invoiceNo", i.invoice_date AS "invoiceDate",
              i.status, i.payment, i.goods_total AS "goodsTotal",
              i.extra_costs AS "extraCosts", i.landed_total AS "landedTotal",
              i.settled_amount AS "settledAmount",
              i.posted_at AS "postedAt", s.name AS "supplierName",
              (SELECT count(*)::int FROM purchase_invoice_line l WHERE l.invoice_id = i.id) AS "lineCount"
       FROM purchase_invoice i
       JOIN supplier s ON s.id = i.supplier_id
       ORDER BY i.invoice_date DESC, i.created_at DESC
       LIMIT 100`,
    );
    return rows.map((r: Parameters<typeof paidStatusOf>[0]) => ({ ...r, paidStatus: paidStatusOf(r) }));
  }

  async getInvoice(id: string) {
    const invoice = await this.db.getRepository(PurchaseInvoice).findOne({
      where: { id },
      relations: { supplier: true },
    });
    if (!invoice) throw new NotFoundException('invoice not found');
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
    return { ...invoice, paidStatus: paidStatusOf(invoice), lines };
  }

  /** Creates a DRAFT invoice — no stock or money moves until it is posted. */
  async createInvoice(input: CreateInvoiceInput, userId: string) {
    this.validateInvoiceInput(input);

    const wantedVariantIds = [...new Set(input.lines.map((l) => l.variantId))];
    const variants = await this.db.getRepository(ProductVariant).findBy({ id: In(wantedVariantIds) });
    if (variants.length !== wantedVariantIds.length) {
      throw new BadRequestException('one or more products no longer exist');
    }

    const lines = input.lines.map((l) => ({
      variantId: l.variantId,
      quantity: l.quantity,
      unitCost: Number(l.unitCost).toFixed(2),
      lineTotal: round2(Number(l.unitCost) * l.quantity).toFixed(2),
      landedUnitCost: null,
    }));
    const goodsTotal = round2(lines.reduce((s, l) => s + Number(l.lineTotal), 0));
    const extraCosts = round2(Number(input.extraCosts ?? 0));

    const invoiceId = await this.db.transaction(async (tx) => {
      const invoice = await tx.save(PurchaseInvoice, {
        supplierId: input.supplierId,
        invoiceNo: input.invoiceNo?.trim() || null,
        invoiceDate: input.invoiceDate,
        status: 'DRAFT' as const,
        payment: input.payment,
        allocation: input.allocation ?? 'BY_VALUE',
        goodsTotal: goodsTotal.toFixed(2),
        extraCosts: extraCosts.toFixed(2),
        landedTotal: round2(goodsTotal + extraCosts).toFixed(2),
        createdById: userId,
      });
      await tx.insert(
        PurchaseInvoiceLine,
        lines.map((l) => ({ ...l, invoiceId: invoice.id })),
      );
      return invoice.id;
    });
    return this.getInvoice(invoiceId);
  }

  async deleteDraft(id: string) {
    const invoice = await this.db.getRepository(PurchaseInvoice).findOneBy({ id });
    if (!invoice) throw new NotFoundException('invoice not found');
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('a posted invoice cannot be deleted — reverse it instead');
    }
    await this.db.getRepository(PurchaseInvoice).delete({ id });
  }

  /**
   * Posts a draft: allocates extra costs across the lines, receives each line
   * into stock at its landed cost, rolls the variant's moving-average cost
   * forward, and books one `INVENTORY ← CASH / SUPPLIER_PAYABLE` entry.
   */
  async postInvoice(id: string, userId: string) {
    await this.db.transaction(async (tx) => {
      const invoice = await tx.findOne(PurchaseInvoice, { where: { id }, relations: { lines: true } });
      if (!invoice) throw new NotFoundException('invoice not found');
      if (invoice.status === 'POSTED') throw new BadRequestException('this invoice is already posted');
      if (!invoice.lines.length) throw new BadRequestException('add at least one line before posting');

      const shares = allocateExtraCosts(
        invoice.lines.map((l) => ({ lineTotal: Number(l.lineTotal), quantity: l.quantity })),
        Number(invoice.extraCosts),
        invoice.allocation,
      );

      for (const [i, line] of invoice.lines.entries()) {
        const landedLineTotal = round2(Number(line.lineTotal) + shares[i]);
        const landedUnitCost = round4(landedLineTotal / line.quantity);

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
          unitCost: round2(landedUnitCost).toFixed(2),
          avgCostAfter: newAvg.toFixed(4),
          sourceType: 'purchase_invoice',
          sourceId: invoice.id,
          occurredAt: new Date(`${invoice.invoiceDate}T00:00:00Z`),
        });
        await tx.update(ProductVariant, { id: line.variantId }, { unitCost: round2(newAvg).toFixed(2) });
        await tx.update(PurchaseInvoiceLine, { id: line.id }, { landedUnitCost: landedUnitCost.toFixed(4) });
      }

      await this.ledger.post(
        {
          amount: invoice.landedTotal,
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

      await tx.update(
        PurchaseInvoice,
        { id },
        {
          status: 'POSTED',
          postedAt: new Date(),
          // A cash invoice is paid the moment it posts.
          settledAmount: invoice.payment === 'CASH' ? invoice.landedTotal : '0',
        },
      );
      this.log.log(`purchase invoice ${id} posted: ${invoice.lines.length} lines, ${invoice.landedTotal}`);
    });
    return this.getInvoice(id);
  }

  private validateInvoiceInput(input: CreateInvoiceInput) {
    if (!input.supplierId) throw new BadRequestException('choose a supplier');
    if (!ISO_DATE.test(input.invoiceDate ?? '')) throw new BadRequestException('invoiceDate must be YYYY-MM-DD');
    if (input.payment !== 'CASH' && input.payment !== 'CREDIT') {
      throw new BadRequestException('payment must be CASH or CREDIT');
    }
    if (input.extraCosts !== undefined && input.extraCosts !== '' && !MONEY.test(input.extraCosts)) {
      throw new BadRequestException('extra costs must be an amount like 5000.00');
    }
    if (!input.lines?.length) throw new BadRequestException('an invoice needs at least one line');
    for (const l of input.lines) {
      if (!l.variantId) throw new BadRequestException('every line needs a product');
      if (!Number.isInteger(l.quantity) || l.quantity < 1) {
        throw new BadRequestException('every line needs a whole quantity of at least 1');
      }
      if (!MONEY.test(l.unitCost ?? '') || Number(l.unitCost) <= 0) {
        throw new BadRequestException('every line needs a unit cost greater than 0');
      }
    }
  }
}
