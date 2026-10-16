import { BadRequestException, Body, Controller, Get, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/auth.guard';
import { ChannelAccount } from '../noon/channel-account.entity';
import { problem } from '../problem';
import { AmazonReportingService } from '../reporting/amazon-reporting.service';
import { AmazonImport } from './amazon-import.entity';
import { AmazonImportService } from './amazon-import.service';
import { AmazonReportFormatError } from './amazon-report.parser';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });

/** Amazon's money is admin-only, like noon's. */
@Roles('ADMIN')
@Controller('amazon')
export class AmazonController {
  constructor(
    private readonly imports: AmazonImportService,
    private readonly reporting: AmazonReportingService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  @Post('imports')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(@UploadedFile() file?: { originalname: string; buffer: Buffer }) {
    if (!file) throw new BadRequestException('no file uploaded (field name must be "file")');
    try {
      return await this.imports.import(file.originalname, file.buffer);
    } catch (e) {
      if (e instanceof AmazonReportFormatError) {
        throw new BadRequestException(problem('import.notAmazon', `not an Amazon transaction report: ${e.message}`));
      }
      throw e;
    }
  }

  @Get('imports')
  listImports() {
    return this.db.getRepository(AmazonImport).find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  @Get('periods')
  periods() {
    return this.reporting.periods();
  }

  /** What Amazon owes today — null until an opening balance is set. */
  @Get('balance')
  async balance() {
    return { balance: await this.reporting.balanceAt(today()) };
  }

  @Get('account')
  async account() {
    return (await this.db.getRepository(ChannelAccount).findOneBy({ channel: 'amazon' })) ?? {
      channel: 'amazon',
      openingBalance: '0',
      openingAsOf: null,
    };
  }

  @Patch('account')
  async setAccount(@Body() body: { openingBalance?: string; openingAsOf?: string }) {
    if (body.openingBalance !== undefined && !/^-?\d+(\.\d{1,2})?$/.test(body.openingBalance)) {
      throw new BadRequestException('openingBalance must be a number');
    }
    if (body.openingAsOf !== undefined && !ISO_DATE.test(body.openingAsOf)) {
      throw new BadRequestException('openingAsOf must be YYYY-MM-DD');
    }
    const repo = this.db.getRepository(ChannelAccount);
    const current = (await repo.findOneBy({ channel: 'amazon' })) ?? repo.create({ channel: 'amazon' });
    Object.assign(current, { openingBalance: body.openingBalance ?? current.openingBalance, openingAsOf: body.openingAsOf ?? current.openingAsOf });
    return repo.save(current);
  }

  @Get('statement')
  statement(@Query('from') from: string, @Query('to') to: string) {
    return this.reporting.statement(...range(from, to));
  }

  @Get('products')
  products(@Query('from') from: string, @Query('to') to: string) {
    return this.reporting.productPerformance(...range(from, to));
  }

  @Get('unattributed')
  unattributed(@Query('from') from: string, @Query('to') to: string) {
    return this.reporting.unattributed(...range(from, to));
  }
}

function range(from: string, to: string): [string, string] {
  if (!ISO_DATE.test(from ?? '') || !ISO_DATE.test(to ?? '')) {
    throw new BadRequestException('from and to are required as YYYY-MM-DD');
  }
  if (from > to) throw new BadRequestException('from must not be after to');
  return [from, to];
}
