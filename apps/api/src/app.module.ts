import { ExpensesController } from './finance/expenses.controller';
import { ExpensesService } from './finance/expenses.service';
import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { ENTITIES } from './database/entities';
import { ormOptions } from './database/orm-options';
import { FinanceController } from './finance/finance.controller';
import { FinanceService } from './finance/finance.service';
import { LedgerService } from './finance/ledger.service';
import { EasyOrdersController } from './integrations/easyorders/easyorders.controller';
import { EasyOrdersService } from './integrations/easyorders/easyorders.service';
import { BostaClient } from './integrations/bosta/bosta.client';
import { BostaController } from './integrations/bosta/bosta.controller';
import { BostaService } from './integrations/bosta/bosta.service';
import { NoonImportService } from './noon/noon-import.service';
import { NoonController } from './noon/noon.controller';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { PurchasesController, SuppliersController } from './purchasing/purchasing.controller';
import { PurchasingService } from './purchasing/purchasing.service';
import { NoonReportingService } from './reporting/noon-reporting.service';

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
      ...ormOptions,
      // Schema now comes from src/database/migrations, run automatically on
      // boot — see src/database/data-source.ts for the CLI that generates them.
      migrationsRun: true,
      synchronize: false,
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  controllers: [
    ExpensesController,
    AuthController,
    NoonController,
    OrdersController,
    CatalogController,
    EasyOrdersController,
    BostaController,
    FinanceController,
    SuppliersController,
    PurchasesController,
  ],
  providers: [
    ExpensesService,
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
    PurchasingService,
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
