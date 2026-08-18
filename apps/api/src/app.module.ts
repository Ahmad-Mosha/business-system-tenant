import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DbModule } from './db/db.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthGuard } from './modules/identity/auth.guard.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { SalesModule } from './modules/sales/sales.module.js';
import { CorrelationMiddleware } from './shared/correlation.middleware.js';
import { HttpExceptionFilter } from './shared/http-exception.filter.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    DbModule,
    AuditModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    IdentityModule,
    SalesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Registered after the throttler so abusive traffic is rejected before it costs a
    // session lookup. Routes are private unless marked @Public.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
