import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
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

@ApiTags('BankFeeds')
@ApiBearerAuth()
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource('gl-accounts')
@Controller('gl/bank-statement')
export class BankStatementController {
  constructor(private readonly bankStatementService: BankStatementService) {}

  @Get('lines')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get bank statement lines',
    description: 'Fetch imported bank statement lines.',
  })
  @ApiOkResponse({ description: 'Returns bank statement lines' })
  @ApiQuery({ name: 'isReconciled', required: false, type: Boolean })
  async getLines(
    @Query('glAccountId') glAccountId: string,
    @Query('isReconciled') isReconciledStr?: string,
  ) {
    let isReconciled: boolean | undefined;
    if (isReconciledStr === 'true') isReconciled = true;
    if (isReconciledStr === 'false') isReconciled = false;

    return {
      data: await this.bankStatementService.getLines(glAccountId, isReconciled),
    };
  }

  @Post('lines/:id/confirm-match')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Confirm a smart match',
    description:
      'Confirms a suggested match between a bank line and a journal line.',
  })
  @ApiOkResponse({ description: 'Match confirmed' })
  @ApiBody({ schema: { type: 'object' } })
  async confirmMatch(@Param('id') id: string, @AuthUser() user: JwtUser) {
    const actor = user?.username || 'system';
    return this.bankStatementService.confirmMatch(id, actor);
  }
}
