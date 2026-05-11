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
} from './dto';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('GL Reconciliations')
@Controller('gl/reconciliations')
@CasbinResource('gl')
export class ReconciliationController {
  constructor(private readonly service: ReconciliationService) {}

  @Get()
  @CasbinAction('read')
  async getReconciliations() {
    const data = await this.service.getReconciliations();
    return { data };
  }

  @Post()
  @CasbinAction('write')
  async createReconciliation(@Body() dto: CreateReconciliationDto) {
    return this.service.createReconciliation(dto);
  }

  @Get(':id')
  @CasbinAction('read')
  async getReconciliation(@Param('id') id: string) {
    return this.service.getReconciliation(id);
  }

  @Get(':id/unreconciled')
  @CasbinAction('read')
  async getLines(@Param('id') id: string) {
    const data = await this.service.getLines(id);
    return { data };
  }

  @Post(':id/lines/:lineId/toggle')
  @CasbinAction('write')
  async toggleLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: ToggleLineDto,
  ) {
    return this.service.toggleLine(id, lineId, dto.isCleared, dto.amount);
  }

  @Post(':id/post')
  @CasbinAction('write')
  async postReconciliation(@Param('id') id: string) {
    return this.service.postReconciliation(id);
  }

  @Delete(':id')
  @CasbinAction('write')
  async discardReconciliation(@Param('id') id: string) {
    return this.service.discardReconciliation(id);
  }

  @Post(':id/adjustments')
  @CasbinAction('write')
  async createAdjustment(
    @Param('id') id: string,
    @Body() dto: CreateAdjustmentDto,
  ) {
    // In a real application, you'd extract the actor from the JWT token
    const actor = 'system';
    return this.service.createAdjustment(id, dto, actor);
  }
}
