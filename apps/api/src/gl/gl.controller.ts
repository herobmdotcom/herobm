import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { GlService, JournalMeta } from './gl.service';
import { CoaLoaderService } from './coa-loader.service';
import {
  JournalLineDto,
  CreateJournalEntryDto,
  GlAccountResponseDto,
  JournalEntryResponseDto,
  TrialBalanceResponseDto,
  GeneralLedgerResponseDto,
  SettingsResponseDto,
  SuccessMessageResponseDto,
  ChartFileDto,
  SettingsFileDto,
  CreateAccountRequestDto,
  UpdateAccountRequestDto,
  SeedRequestDto,
  SeedTaxRequestDto,
  EmptyBodyDto,
  PaginatedJournalEntriesDto,
  PaginatedGeneralLedgerDto,
  UpdateGLSettingsDto,
} from './dto';
import { AppConfigService } from '../settings/app-config.service';
import { GLAccountType, SystemResource } from '@herobm/shared';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { ApiPaginatedResponse } from '../common/pagination';

@ApiTags('General Ledger')
@Controller('gl')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.GL)
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
  @ApiOperation({
    summary: 'Get Accounts',
    description: 'Retrieve the chart of accounts or a flat list of accounts.',
  })
  @ApiOkResponse({ type: [GlAccountResponseDto] })
  @ApiQuery({ name: 'format', required: false, enum: ['tree', 'flat'] })
  @ApiQuery({ name: 'isBankAccount', required: false, type: String })
  async getAccounts(
    @Query('format') format?: 'tree' | 'flat',
    @Query('isBankAccount') isBankAccount?: string,
  ) {
    if (format === 'tree') {
      return this.glService.getChartOfAccounts();
    }
    const filterIsBankAccount =
      isBankAccount === 'true'
        ? true
        : isBankAccount === 'false'
          ? false
          : undefined;
    return this.glService.getAccountsList({
      isBankAccount: filterIsBankAccount,
    });
  }

  @Post('accounts')
  @ApiBody({ type: CreateAccountRequestDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Account',
    description: 'Create a new general ledger account.',
  })
  @ApiCreatedResponse({ type: GlAccountResponseDto })
  async createAccount(
    @Body()
    body: CreateAccountRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.glService.createAccount(
      body as unknown as Parameters<GlService['createAccount']>[0],
      user?.userId,
    );
  }

  @Patch('accounts/:id')
  @ApiBody({ type: UpdateAccountRequestDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Account',
    description: 'Modify an existing general ledger account.',
  })
  @ApiOkResponse({ type: GlAccountResponseDto })
  async updateAccount(
    @Param('id') id: string,
    @Body()
    body: UpdateAccountRequestDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.glService.updateAccount(id, body, user?.userId);
  }

  // -------------------------------------------------------------------------
  // Journal Entries
  // -------------------------------------------------------------------------

  @Get('journal-entries')
  @ApiOkResponse({ type: PaginatedJournalEntriesDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Journal Entries',
    description: 'Retrieve a paginated list of journal entries.',
  })
  @ApiPaginatedResponse(JournalEntryResponseDto)
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'sourceType', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
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
  @ApiOperation({
    summary: 'Get Journal Entry',
    description: 'Retrieve a specific journal entry by ID.',
  })
  @ApiOkResponse({ type: JournalEntryResponseDto })
  async getJournalEntry(@Param('id') id: string) {
    return this.glService.getJournalEntry(id);
  }

  @Get('journal-entries/source/:type/:id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Source Entry',
    description: 'Find a journal entry by its source transaction type and ID.',
  })
  @ApiOkResponse({ type: JournalEntryResponseDto })
  async getJournalEntryBySource(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.glService.findJournalEntryBySource(type, id);
  }

  @Post('journal-entries')
  @ApiBody({ type: CreateJournalEntryDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Manual Entry',
    description: 'Post a new manual journal entry to the ledger.',
  })
  @UseInterceptors(IdempotencyInterceptor)
  @Idempotent({
    queryKey: 'glJournalEntries',
    pkField: 'journalEntryId',
    idBodyPath: 'journalEntryId',
  })
  @ApiCreatedResponse({ type: JournalEntryResponseDto })
  async createManualJournalEntry(
    @Body()
    body: CreateJournalEntryDto,
  ) {
    const meta: JournalMeta = {
      sourceType: 'manual',
      memo: body.memo,
      entryDate: body.entryDate,
      actor: body.actor,
      journalEntryId: body.journalEntryId,
    };
    return this.glService.postJournalEntry(body.lines, meta);
  }

  // -------------------------------------------------------------------------
  // Reports
  // -------------------------------------------------------------------------

  @Get('trial-balance')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Trial Balance',
    description:
      'Calculate and retrieve the trial balance as of a specific date.',
  })
  @ApiOkResponse({ type: [TrialBalanceResponseDto] })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getTrialBalance(@Query('asOfDate') asOfDate?: string) {
    return this.glService.getTrialBalance(asOfDate);
  }

  @Get('general-ledger')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get General Ledger',
    description:
      'Retrieve the general ledger line items for specific accounts and date ranges.',
  })
  @ApiPaginatedResponse(GeneralLedgerResponseDto)
  @ApiQuery({ name: 'account', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
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
  @ApiOperation({
    summary: 'Get Settings',
    description: 'Retrieve the current general ledger settings.',
  })
  @ApiOkResponse({ type: SettingsResponseDto })
  async getSettings() {
    return this.glService.getSettings();
  }

  @Patch('settings')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Settings',
    description: 'Update the general ledger configuration settings.',
  })
  @ApiBody({ schema: { type: 'object', additionalProperties: true } })
  @ApiOkResponse({ type: SettingsResponseDto })
  async updateSettings(@Body() body: Record<string, unknown>) {
    const updated = await this.glService.updateSettings(body);
    // Automatically reload app config cache since settings changed
    await this.appConfig.reload();
    return updated;
  }

  @Post('settings/reload')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Reload Settings',
    description: 'Force a reload of the application configuration cache.',
  })
  @ApiCreatedResponse({ type: SuccessMessageResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  async reloadSettings() {
    await this.appConfig.reload();
    return { success: true, message: 'Settings cache reloaded successfully.' };
  }

  @Get('charts')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Charts',
    description: 'Get available predefined chart of accounts templates.',
  })
  @ApiOkResponse({ type: [ChartFileDto] })
  async listCharts() {
    return this.coaLoader.listAvailableCharts();
  }

  @Post('seed')
  @ApiBody({ type: SeedRequestDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Seed Chart of Accounts',
    description:
      'Initialize the chart of accounts from a predefined template file.',
  })
  @ApiCreatedResponse({ type: SuccessMessageResponseDto })
  async seedChartOfAccounts(@Body() body: SeedRequestDto) {
    const filename = body?.filename || 'au_standard.json';
    return this.coaLoader.loadFromFile(filename);
  }

  @Get('tax-settings-files')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Tax Settings',
    description: 'Get available predefined tax configuration templates.',
  })
  @ApiOkResponse({ type: [SettingsFileDto] })
  async listTaxSettingsFiles() {
    return this.coaLoader.listAvailableTaxSettings();
  }

  @Post('seed-tax')
  @ApiBody({ type: SeedTaxRequestDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Seed Tax Settings',
    description:
      'Initialize tax rates and rules from a predefined template file.',
  })
  @ApiCreatedResponse({ type: SuccessMessageResponseDto })
  async seedTaxSettings(@Body() body: SeedTaxRequestDto) {
    return this.coaLoader.loadTaxSettingsFromFile(body.filename);
  }
}
