// security-ignore: dto-validation
import { SystemResource } from '@herobm/shared';
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import { BankStatementService } from './bank-statement.service';
import { BankFeedsService } from './bank-feeds.service';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

import {
  BankStatementLineDto,
  BankStatementConfirmMatchDto,
  BankStatementManualMatchDto,
  CreateBankStatementLineDto,
  BankStatementBulkMatchDto,
  AutoMatchResponseDto,
  AutoMatchRequestDto,
  UnmatchRequestDto,
  BankStatementSuccessResponseDto,
  BankStatementMatchGroupResponseDto,
} from './dto/bank-statement.dto';
import { MatchConfirmedResponseDto } from './dto';

@ApiTags('General Ledger')
@ApiBearerAuth()
@CasbinResource(SystemResource.GL)
@Controller('gl/bank-statement')
export class BankStatementController {
  constructor(
    private readonly bankStatementService: BankStatementService,
    private readonly bankFeedsService: BankFeedsService,
  ) {}

  @Get('lines')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get bank statement lines',
    description: 'Fetch imported bank statement lines.',
  })
  @ApiOkResponse({
    description: 'Returns bank statement lines',
    type: [BankStatementLineDto],
  })
  @ApiQuery({ name: 'isReconciled', required: false, type: Boolean })
  async getLines(
    @Query('glAccountId') glAccountId: string,
    @Query('isReconciled') isReconciledStr?: string,
  ) {
    let isReconciled: boolean | undefined;
    if (isReconciledStr === 'true') isReconciled = true;
    if (isReconciledStr === 'false') isReconciled = false;

    return await this.bankStatementService.getLines(glAccountId, isReconciled);
  }

  @Post('lines/:id/confirm-match')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Confirm a smart match',
    description:
      'Confirms a suggested match between a bank line and a journal line.',
  })
  @ApiCreatedResponse({
    description: 'Match confirmed',
    type: MatchConfirmedResponseDto,
  })
  @ApiBody({ type: BankStatementConfirmMatchDto })
  async confirmMatch(
    @Param('id') id: string,
    @Body() dto: BankStatementConfirmMatchDto,
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'system';
    return this.bankStatementService.confirmMatch(
      id,
      actor,
      dto.reconciliationId,
    );
  }

  @Post('lines/:id/manual-match')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Manually match a line',
    description: 'Manually links a bank line to a specific journal line.',
  })
  @ApiCreatedResponse({
    description: 'Match confirmed',
    type: MatchConfirmedResponseDto,
  })
  @ApiBody({ type: BankStatementManualMatchDto })
  async manualMatch(
    @Param('id') id: string,
    @Body() dto: BankStatementManualMatchDto,
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'system';
    return this.bankStatementService.manualMatch(
      id,
      dto.journalLineId,
      actor,
      dto.reconciliationId,
    );
  }

  @Post('lines/bulk')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create bank statement lines in bulk',
    description: 'Manually creates multiple bank statement lines at once.',
  })
  @ApiCreatedResponse({
    description: 'Lines created',
    type: MatchConfirmedResponseDto, // Using same generic response for simplicity
  })
  @ApiBody({ type: [CreateBankStatementLineDto] })
  async createLinesBulk(
    @Body() dtos: CreateBankStatementLineDto[],
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'system';
    return this.bankStatementService.createLinesBulk(dtos, actor);
  }

  @Post('match-bulk')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Bulk match bank statement lines and journal lines',
    description: 'Links an N:M set of bank lines and journal lines together.',
  })
  @ApiCreatedResponse({
    description: 'Match confirmed',
    type: MatchConfirmedResponseDto,
  })
  @ApiBody({ type: BankStatementBulkMatchDto })
  async matchBulk(
    @Body() dto: BankStatementBulkMatchDto,
    @AuthUser() user: JwtUser,
  ) {
    const actor = user?.username || 'system';
    return this.bankStatementService.matchBulk(
      dto.bankLineIds,
      dto.journalLineIds,
      dto.reconciliationId,
      actor,
    );
  }

  @Post('auto-match')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Auto match bank statement lines',
    description: 'Runs auto-matching rules and suggests smart matches.',
  })
  @ApiBody({ type: AutoMatchRequestDto })
  @ApiCreatedResponse({ type: AutoMatchResponseDto })
  async autoMatch(@Body() dto: AutoMatchRequestDto, @AuthUser() user: JwtUser) {
    return this.bankFeedsService.executeAutoMatching(
      dto.glAccountId,
      user.username,
      dto.reconciliationId,
      dto.dryRun || false,
      dto.ignoredStatementLineIds,
    );
  }

  @Post('unmatch')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Unmatch items',
    description:
      'Breaks a match group, and reverses any rule-generated entries.',
  })
  @ApiBody({ type: UnmatchRequestDto })
  @ApiCreatedResponse({ type: BankStatementSuccessResponseDto })
  async unmatch(@Body() dto: UnmatchRequestDto, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    return this.bankStatementService.unmatch(dto.matchGroupId, actor);
  }

  @Delete('lines/:id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete bank statement line',
    description: 'Deletes a bank statement line that has not been reconciled.',
  })
  @ApiOkResponse({ type: BankStatementSuccessResponseDto })
  async deleteLine(@Param('id') id: string, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    return this.bankStatementService.deleteLine(id, actor);
  }

  @Get('match-group/:matchGroupId')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get match group',
    description: 'Retrieves metadata about a match group',
  })
  @ApiOkResponse({ type: BankStatementMatchGroupResponseDto })
  async getMatchGroup(@Param('matchGroupId') matchGroupId: string) {
    return this.bankStatementService.getMatchGroup(matchGroupId);
  }
}
