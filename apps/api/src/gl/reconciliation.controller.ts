import { SystemResource } from '@modbm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import {
  CreateReconciliationDto,
  ToggleLineDto,
  CreateAdjustmentDto,
  ReconciliationListResponseDto,
  CreateReconciliationResponseDto,
  ReconciliationDetailResponseDto,
  UnreconciledLinesResponseDto,
  ToggleLineResponseDto,
  PostReconciliationResponseDto,
  DiscardReconciliationResponseDto,
  CreateAdjustmentResponseDto,
  EmptyBodyDto,
} from './dto';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';

@ApiTags('GL')
@Controller('gl/reconciliations')
@CasbinResource(SystemResource.GL)
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Get()
  @ApiOkResponse({ type: [Object] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Reconciliations',
    description: 'Retrieve a list of all bank reconciliations.',
  })
  async getReconciliations() {
    const data = await this.service.getReconciliations();
    return data;
  }

  @Post()
  @ApiBody({ type: CreateReconciliationDto })
  @ApiCreatedResponse({ type: CreateReconciliationResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Reconciliation',
    description: 'Start a new bank reconciliation process.',
  })
  async createReconciliation(@Body() dto: CreateReconciliationDto) {
    return this.service.createReconciliation(dto);
  }

  @Get(':id')
  @ApiOkResponse({ type: ReconciliationDetailResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Reconciliation',
    description: 'Retrieve details of a specific bank reconciliation.',
  })
  async getReconciliation(@Param('id') id: string) {
    return this.service.getReconciliation(id);
  }

  @Get(':id/unreconciled')
  @ApiOkResponse({ type: [Object] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Unreconciled Lines',
    description: 'Retrieve unreconciled ledger lines for the bank account.',
  })
  async getLines(@Param('id') id: string) {
    const data = await this.service.getLines(id);
    return data;
  }

  @Post(':id/lines/:lineId/toggle')
  @ApiBody({ type: ToggleLineDto })
  @ApiCreatedResponse({ type: ToggleLineResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Toggle Line Status',
    description: 'Mark a specific ledger line as cleared or uncleared.',
  })
  async toggleLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: ToggleLineDto,
  ) {
    return this.service.toggleLine(id, lineId, dto.isCleared, dto.amount);
  }

  @Post(':id/post')
  @ApiBody({ type: EmptyBodyDto })
  @ApiCreatedResponse({ type: PostReconciliationResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Post Reconciliation',
    description: 'Finalize and post the completed bank reconciliation.',
  })
  async postReconciliation(@Param('id') id: string) {
    return this.service.postReconciliation(id);
  }

  @Delete(':id')
  @ApiOkResponse({ type: DiscardReconciliationResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Discard Reconciliation',
    description: 'Cancel and delete an in-progress bank reconciliation.',
  })
  async discardReconciliation(@Param('id') id: string) {
    return this.service.discardReconciliation(id);
  }

  @Post(':id/adjustments')
  @ApiBody({ type: CreateAdjustmentDto })
  @ApiCreatedResponse({ type: CreateAdjustmentResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Adjustment',
    description: 'Create a journal entry adjustment for bank fees or interest.',
  })
  async createAdjustment(
    @Param('id') id: string,
    @Body() dto: CreateAdjustmentDto,
  ) {
    // In a real application, you'd extract the actor from the JWT token
    const actor = 'system';
    return this.service.createAdjustment(id, dto, actor);
  }
}
