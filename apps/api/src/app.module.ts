import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmazonImportService } from './amazon/amazon-import.service';
import { AmazonController } from './amazon/amazon.controller';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { resolveJwtSecret } from './auth/bootstrap-config';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { ENTITIES } from './database/entities';
import { MigrationGuardService } from './database/migration-guard.service';
import { ormOptions } from './database/orm-options';
import { ExpensesController } from './finance/expenses.controller';
import { ExpensesService } from './finance/expenses.service';
import { FinanceController } from './finance/finance.controller';
import { FinanceService } from './finance/finance.service';
import { LedgerService } from './finance/ledger.service';
import { BostaClient } from './integrations/bosta/bosta.client';
import { BostaController } from './integrations/bosta/bosta.controller';
import { BostaService } from './integrations/bosta/bosta.service';
import { EasyOrdersController } from './integrations/easyorders/easyorders.controller';
import { EasyOrdersService } from './integrations/easyorders/easyorders.service';
import { NoonImportService } from './noon/noon-import.service';
import { NoonController } from './noon/noon.controller';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { PurchasesController, SuppliersController } from './purchasing/purchasing.controller';
import { PurchasingService } from './purchasing/purchasing.service';
import { AmazonReportingService } from './reporting/amazon-reporting.service';
import { NoonReportingService } from './reporting/noon-reporting.service';
import { PerformanceService } from './reporting/performance.service';
import { CustomersController, SalesInvoicesController } from './sales/sales.controller';
import { SalesService } from './sales/sales.service';

@Module({
  imports: [
    // The API runs with its own directory as cwd, so the repo-root .env is
    // named explicitly; a local apps/api/.env still wins if one exists.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret({
          NODE_ENV: config.get<string>('NODE_ENV'),
          JWT_SECRET: config.get<string>('JWT_SECRET'),
        }),
        // Thirty days: people stay signed in through normal use; signing out ends it at once.
        signOptions: { expiresIn: '30d' },
      }),
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      ...ormOptions,
      // Schema comes from src/database/migrations, run on boot in production.
      // `npm run dev` sets MIGRATIONS=manual: a hot reload must never apply a
      // migration file that is still being written — `npm run db:migrate` does,
      // on purpose (src/database/migrate.ts).
      migrationsRun: process.env.MIGRATIONS !== 'manual',
      synchronize: false,
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  controllers: [
    ExpensesController,
    AuthController,
    NoonController,
    AmazonController,
    OrdersController,
    CatalogController,
    EasyOrdersController,
    BostaController,
    FinanceController,
    SuppliersController,
    PurchasesController,
    CustomersController,
    SalesInvoicesController,
  ],
  providers: [
    MigrationGuardService,
    ExpensesService,
    // Every endpoint requires a session unless it opts out with @Public(),
    // so a new controller is protected by default rather than by remembering.
    { provide: APP_GUARD, useClass: AuthGuard },
    AuthService,
    NoonImportService,
    NoonReportingService,
    AmazonImportService,
    AmazonReportingService,
    PerformanceService,
    OrdersService,
    CatalogService,
    EasyOrdersService,
    BostaClient,
    BostaService,
    FinanceService,
    LedgerService,
    PurchasingService,
    SalesService,
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private readonly auth: AuthService,
    private readonly ledger: LedgerService,
  ) {}

  async onModuleInit() {
    await this.auth.seedInitialUsers();
    await this.ledger.seedAccounts();
  }
}
