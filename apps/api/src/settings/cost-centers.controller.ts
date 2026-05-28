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
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CostCentersService } from './cost-centers.service';
import {
  CreateCostCenterDto,
  UpdateCostCenterDto,
  BulkImportResultDto,
  CostCenterResponseDto,
} from './dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('System')
@Controller('settings/cost-centers')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class CostCentersController {
  constructor(private readonly service: CostCentersService) {}

  @Get()
  @ApiOkResponse({ type: [CostCenterResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List all cost centers',
    description: 'List all cost centers',
  })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @ApiBody({ type: CreateCostCenterDto })
  @ApiCreatedResponse({ type: CostCenterResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create a new cost center',
    description: 'Create a new cost center',
  })
  create(@Body() dto: CreateCostCenterDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateCostCenterDto })
  @ApiOkResponse({ type: CostCenterResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update a cost center',
    description: 'Update a cost center',
  })
  update(@Param('id') id: string, @Body() dto: UpdateCostCenterDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: CostCenterResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete a cost center',
    description: 'Delete a cost center',
  })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post('import')
  @ApiBody({ type: [CreateCostCenterDto] })
  @ApiCreatedResponse({ type: BulkImportResultDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Bulk import cost centers',
    description: 'Bulk import cost centers',
  })
  import(@Body() data: CreateCostCenterDto[]): Promise<BulkImportResultDto> {
    return this.service.importMany(data);
  }
}
