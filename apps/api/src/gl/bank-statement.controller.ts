import { SystemResource } from '@modbm/shared';
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Body,
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
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinAction,
  CasbinResource,
} from '../auth/casbin.guard';
import { BankStatementService } from './bank-statement.service';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

import {
  BankStatementLineDto,
  BankStatementConfirmMatchDto,
  BankStatementManualMatchDto,
} from './dto/bank-statement.dto';
import { MatchConfirmedResponseDto } from './dto';

@ApiTags('BankFeeds')
@ApiBearerAuth()
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.GL)
@Controller('gl/bank-statement')
export class BankStatementController {
  constructor(private readonly bankStatementService: BankStatementService) {}

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
}
