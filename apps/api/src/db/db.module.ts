import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service.js';
import { TenantService } from './tenant.service.js';

@Global()
@Module({
  providers: [DbService, TenantService],
  exports: [DbService, TenantService],
})
export class DbModule {}
