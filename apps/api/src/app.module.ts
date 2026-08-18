import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
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
    // Limits are declared per route with @Throttle; this only supplies storage.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1_000_000 }]),
    IdentityModule,
    SalesModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // Routes are private unless explicitly marked @Public, so forgetting a decorator
    // locks a route down rather than exposing it.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
