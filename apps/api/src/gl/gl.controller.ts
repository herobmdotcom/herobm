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
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { GlService, JournalMeta } from './gl.service';
import { CoaLoaderService } from './coa-loader.service';
import { JournalLineDto } from './dto';
import { AppConfigService } from '../settings/app-config.service';

@Controller('gl')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('gl')
export class GlController {
  constructor(
    private readonly glService: GlService,
    private readonly coaLoader: CoaLoaderService,
    private readonly appConfig: AppConfigService,
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
      isBankAccount?: boolean;
      currencyCode?: string;
      metadata?: Record<string, any>;
    },
  ) {
    return this.glService.createAccount(body);
  }

  @Patch('accounts/:id')
  @CasbinAction('write')
  async updateAccount(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      isActive?: boolean;
      isBankAccount?: boolean;
      metadata?: Record<string, any>;
    },
  ) {
    return this.glService.updateAccount(id, body);
  }

  // -------------------------------------------------------------------------
  // Journal Entries
  // -------------------------------------------------------------------------

  @Get('journal-entries')
  @CasbinAction('read')
  async getJournalEntries(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('sourceType') sourceType?: string,
    @Query('q') entryNumber?: string,
    @Query('limit') limitStr?: string,
    @Query('page') pageStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    return this.glService.getJournalEntries({
      fromDate,
      toDate,
      sourceType,
      entryNumber,
      limit,
      page,
    });
  }

  @Get('journal-entries/:id')
  @CasbinAction('read')
  async getJournalEntry(@Param('id') id: string) {
    return this.glService.getJournalEntry(id);
  }

  @Get('journal-entries/source/:type/:id')
  @CasbinAction('read')
  async getJournalEntryBySource(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.glService.findJournalEntryBySource(type, id);
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
  async getTrialBalance(@Query('asOfDate') asOfDate?: string) {
    return this.glService.getTrialBalance(asOfDate);
  }

  @Get('general-ledger')
  @CasbinAction('read')
  async getGeneralLedger(
    @Query('account') accountCode?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limitStr?: string,
    @Query('page') pageStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    return this.glService.getGeneralLedger({
      accountCode,
      fromDate,
      toDate,
      limit,
      page,
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

  @Patch('settings')
  @CasbinAction('write')
  async updateSettings(@Body() body: any) {
    const updated = await this.glService.updateSettings(body);
    // Automatically reload app config cache since settings changed
    await this.appConfig.reload();
    return updated;
  }

  @Post('settings/reload')
  @CasbinAction('write')
  async reloadSettings() {
    await this.appConfig.reload();
    return { success: true, message: 'Settings cache reloaded successfully.' };
  }

  @Post('seed')
  @CasbinAction('write')
  async seedChartOfAccounts(@Body() body?: { filename?: string }) {
    const filename = body?.filename || 'au_standard.json';
    return this.coaLoader.loadFromFile(filename);
  }
}
