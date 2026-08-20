import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelListing } from './catalog/channel-listing.entity';
import { Product } from './catalog/product.entity';
import { NoonImport } from './noon/noon-import.entity';
import { NoonImportService } from './noon/noon-import.service';
import { NoonTransaction } from './noon/noon-transaction.entity';
import { NoonController } from './noon/noon.controller';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';
import { NoonReportingService } from './reporting/noon-reporting.service';

const ENTITIES = [Product, ChannelListing, NoonImport, NoonTransaction];

@Module({
  imports: [
    // The API runs with its own directory as cwd, so the repo-root .env is
    // named explicitly; a local apps/api/.env still wins if one exists.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: ENTITIES,
      namingStrategy: new SnakeNamingStrategy(),
      // ponytail: schema sync while the model is still moving. Swap for
      // generated migrations before this touches real data.
      synchronize: true,
    }),
    TypeOrmModule.forFeature(ENTITIES),
  ],
  controllers: [NoonController],
  providers: [NoonImportService, NoonReportingService],
})
export class AppModule {}
