import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NoonReportingService } from '../reporting/noon-reporting.service';
import { ChannelAccount } from './channel-account.entity';
import { NoonImport } from './noon-import.entity';
import { NoonImportService } from './noon-import.service';
import { NoonReportFormatError } from './noon-report.parser';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 20 MB — the July export is ~250 KB, so this is generous headroom. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@Controller('noon')
export class NoonController {
  constructor(
    private readonly imports: NoonImportService,
    private readonly reporting: NoonReportingService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  @Post('imports')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file?: { originalname: string; buffer: Buffer }) {
    if (!file) throw new BadRequestException('no file uploaded (field name must be "file")');
    try {
      return await this.imports.import(file.originalname, file.buffer);
    } catch (e) {
      // A bad file is the caller's problem, not a 500.
      if (e instanceof NoonReportFormatError) {
        throw new BadRequestException(`not a noon settlement export: ${e.message}`);
      }
      throw e;
    }
  }

  @Get('imports')
  listImports() {
    return this.db.getRepository(NoonImport).find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  @Get('periods')
  periods() {
    return this.reporting.periods();
  }

  @Get('account')
  async account() {
    const repo = this.db.getRepository(ChannelAccount);
    return (await repo.findOneBy({ channel: 'noon' })) ?? {
      channel: 'noon',
      openingBalance: '0',
      openingAsOf: null,
    };
  }

  /** Sets the anchor the running balance is measured from. */
  @Patch('account')
  async setAccount(@Body() body: { openingBalance?: string; openingAsOf?: string }) {
    if (body.openingBalance !== undefined && !/^-?\d+(\.\d{1,2})?$/.test(body.openingBalance)) {
      throw new BadRequestException('openingBalance must be a number');
    }
    if (body.openingAsOf !== undefined && !ISO_DATE.test(body.openingAsOf)) {
      throw new BadRequestException('openingAsOf must be YYYY-MM-DD');
    }
    const repo = this.db.getRepository(ChannelAccount);
    const current = (await repo.findOneBy({ channel: 'noon' })) ?? repo.create({ channel: 'noon' });
    Object.assign(current, body);
    return repo.save(current);
  }

  @Get('statement')
  statement(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('openingBalance') openingBalance?: string,
  ) {
    return this.reporting.statement(...this.range(from, to), openingBalance);
  }

  @Get('products')
  products(@Query('from') from: string, @Query('to') to: string) {
    return this.reporting.productPerformance(...this.range(from, to));
  }

  @Get('unattributed')
  unattributed(@Query('from') from: string, @Query('to') to: string) {
    return this.reporting.unattributed(...this.range(from, to));
  }

  private range(from: string, to: string): [string, string] {
    if (!ISO_DATE.test(from ?? '') || !ISO_DATE.test(to ?? '')) {
      throw new BadRequestException('from and to are required as YYYY-MM-DD');
    }
    if (from > to) throw new BadRequestException('from must not be after to');
    return [from, to];
  }
}
