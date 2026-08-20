import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NoonReportingService } from '../reporting/noon-reporting.service';
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

  @Get('statement')
  statement(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('openingBalance') openingBalance = '0',
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
