import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module.js';
import { OrderDetailService } from './order-detail.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [CatalogModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderDetailService],
  exports: [OrderDetailService],
})
export class SalesModule {}
