import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { CatalogueModule } from './catalogue/catalogue.module.js';
import { DbModule } from './db/db.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    DbModule,
    AuthModule,
    CatalogueModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
