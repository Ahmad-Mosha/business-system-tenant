import { Expense, ExpenseCategory } from '../finance/expense.entity';
import { User } from '../auth/user.entity';
import { ChannelListing } from '../catalog/channel-listing.entity';
import { ProductVariant } from '../catalog/product-variant.entity';
import { Product } from '../catalog/product.entity';
import { Cheque } from '../finance/cheque.entity';
import { LedgerAccount } from '../finance/ledger-account.entity';
import { LedgerEntry } from '../finance/ledger-entry.entity';
import { EasyOrdersEvent } from '../integrations/easyorders/easyorders-event.entity';
import { StockMovement } from '../inventory/stock-movement.entity';
import { ChannelAccount } from '../noon/channel-account.entity';
import { NoonImport } from '../noon/noon-import.entity';
import { NoonTransaction } from '../noon/noon-transaction.entity';
import { OrderEvent } from '../orders/order-event.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Order } from '../orders/order.entity';
import { PurchaseInvoice, PurchaseInvoiceLine } from '../purchasing/purchase-invoice.entity';
import { Supplier } from '../purchasing/supplier.entity';

/** Shared with app.module.ts (runtime) and database/data-source.ts (CLI) so they can never drift apart. */
export const ENTITIES = [
  Expense, ExpenseCategory,
  User,
  Product,
  ProductVariant,
  ChannelListing,
  StockMovement,
  Order,
  OrderItem,
  OrderEvent,
  NoonImport,
  NoonTransaction,
  ChannelAccount,
  EasyOrdersEvent,
  LedgerAccount,
  LedgerEntry,
  Cheque,
  Supplier,
  PurchaseInvoice,
  PurchaseInvoiceLine,
];
