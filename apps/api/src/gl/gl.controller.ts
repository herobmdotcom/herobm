import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CasbinGuard, CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { GlService, JournalLineDto, JournalMeta } from './gl.service';
import { CoaLoaderService } from './coa-loader.service';

@Controller('gl')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('gl')
export class GlController {
  constructor(
    private readonly glService: GlService,
    private readonly coaLoader: CoaLoaderService,
  ) {}

  // -------------------------------------------------------------------------
  // Chart of Accounts
  // -------------------------------------------------------------------------

  @Get('accounts')
  @CasbinAction('read')
  async getAccounts(@Query('format') format?: string) {
    if (format === 'tree') {
      return this.glService.getChartOfAccounts();
    }
    return this.glService.getAccountsList();
  }

  @Post('accounts')
  @CasbinAction('write')
  async createAccount(
    @Body()
    body: {
      accountCode: string;
      name: string;
      accountType: string;
      parentAccountId?: string;
      isGroup?: boolean;
      currencyCode?: string;
    },
  ) {
    return this.glService.createAccount(body);
  }

  @Patch('accounts/:id')
  @CasbinAction('write')
  async updateAccount(
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
  ) {
    return this.glService.updateAccount(id, body);
  }

  // -------------------------------------------------------------------------
  // Journal Entries
  // -------------------------------------------------------------------------

  @Get('journal-entries')
  @CasbinAction('read')
  async getJournalEntries(
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
    @Query('sourceType') sourceType?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.glService.getJournalEntries({
      fromDate,
      toDate,
      sourceType,
      limit,
    });
  }

  @Get('journal-entries/:id')
  @CasbinAction('read')
  async getJournalEntry(@Param('id') id: string) {
    return this.glService.getJournalEntry(id);
  }

  @Post('journal-entries')
  @CasbinAction('write')
  async createManualJournalEntry(
    @Body()
    body: {
      lines: JournalLineDto[];
      memo?: string;
      entryDate?: string;
      actor?: string;
    },
  ) {
    const meta: JournalMeta = {
      sourceType: 'manual',
      memo: body.memo,
      entryDate: body.entryDate,
      actor: body.actor,
    };
    return this.glService.postJournalEntry(body.lines, meta);
  }

  // -------------------------------------------------------------------------
  // Reports
  // -------------------------------------------------------------------------

  @Get('trial-balance')
  @CasbinAction('read')
  async getTrialBalance(@Query('asOf') asOfDate?: string) {
    return this.glService.getTrialBalance(asOfDate);
  }

  @Get('general-ledger')
  @CasbinAction('read')
  async getGeneralLedger(
    @Query('account') accountCode?: string,
    @Query('from') fromDate?: string,
    @Query('to') toDate?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    return this.glService.getGeneralLedger({
      accountCode,
      fromDate,
      toDate,
      limit,
    });
  }

  // -------------------------------------------------------------------------
  // Settings & Seed
  // -------------------------------------------------------------------------

  @Get('settings')
  @CasbinAction('read')
  async getSettings() {
    return this.glService.getSettings();
  }

  @Post('seed')
  @CasbinAction('write')
  async seedChartOfAccounts(
    @Body() body?: { filename?: string },
  ) {
    const filename = body?.filename || 'au_standard.json';
    return this.coaLoader.loadFromFile(filename);
  }
}
