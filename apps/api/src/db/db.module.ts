import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';
import { TenantService } from './tenant.service';

@Global()
@Module({
  providers: [DbService, TenantService],
  exports: [DbService, TenantService],
})
export class DbModule {}
