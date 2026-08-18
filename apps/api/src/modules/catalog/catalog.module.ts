import { Module } from '@nestjs/common';
import { EasyOrdersClient } from '../integrations/easyorders/easyorders.client.js';
import { EasyOrdersCatalogImport } from '../integrations/easyorders/catalog-import.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, EasyOrdersClient, EasyOrdersCatalogImport],
  exports: [CatalogService, EasyOrdersClient],
})
export class CatalogModule {}
