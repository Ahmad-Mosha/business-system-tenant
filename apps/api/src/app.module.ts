import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { User } from './auth/user.entity';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { ChannelListing } from './catalog/channel-listing.entity';
import { ProductVariant } from './catalog/product-variant.entity';
import { Product } from './catalog/product.entity';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';
import { FinanceController } from './finance/finance.controller';
import { FinanceService } from './finance/finance.service';
import { LedgerAccount } from './finance/ledger-account.entity';
import { LedgerEntry } from './finance/ledger-entry.entity';
import { LedgerService } from './finance/ledger.service';
import { EasyOrdersController } from './integrations/easyorders/easyorders.controller';
import { EasyOrdersEvent } from './integrations/easyorders/easyorders-event.entity';
import { EasyOrdersService } from './integrations/easyorders/easyorders.service';
import { BostaClient } from './integrations/bosta/bosta.client';
import { BostaController } from './integrations/bosta/bosta.controller';
import { BostaService } from './integrations/bosta/bosta.service';
import { StockMovement } from './inventory/stock-movement.entity';
import { ChannelAccount } from './noon/channel-account.entity';
import { NoonImport } from './noon/noon-import.entity';
import { NoonImportService } from './noon/noon-import.service';
import { NoonTransaction } from './noon/noon-transaction.entity';
import { NoonController } from './noon/noon.controller';
import { OrderEvent } from './orders/order-event.entity';
import { OrderItem } from './orders/order-item.entity';
import { Order } from './orders/order.entity';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { NoonReportingService } from './reporting/noon-reporting.service';

const ENTITIES = [
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
];

@Module({
  imports: [
    // The API runs with its own directory as cwd, so the repo-root .env is
    // named explicitly; a local apps/api/.env still wins if one exists.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret',
      signOptions: { expiresIn: '12h' },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: ENTITIES,
      namingStrategy: new SnakeNamingStrategy(),
      // ponytail: schema sync while the model is still moving. Swap for
      // generated migrations before real inventory data lands.
      synchronize: true,
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  controllers: [
    AuthController,
    NoonController,
    OrdersController,
    CatalogController,
    EasyOrdersController,
    BostaController,
    FinanceController,
  ],
  providers: [
    // Every endpoint requires a session unless it opts out with @Public(),
    // so a new controller is protected by default rather than by remembering.
    { provide: APP_GUARD, useClass: AuthGuard },
    AuthService,
    NoonImportService,
    NoonReportingService,
    OrdersService,
    CatalogService,
    EasyOrdersService,
    BostaClient,
    BostaService,
    FinanceService,
    LedgerService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly auth: AuthService,
    private readonly ledger: LedgerService,
  ) {}

  async onModuleInit() {
    await this.auth.seedDevUsers();
    await this.ledger.seedAccounts();
  }
}
