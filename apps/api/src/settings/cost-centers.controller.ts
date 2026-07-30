import { SystemResource } from '@herobm/shared';
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
} from '@nestjs/common';
import { CostCentersService } from './cost-centers.service';
import {
  CreateCostCenterDto,
  UpdateCostCenterDto,
  BulkImportResultDto,
  CostCenterResponseDto,
} from './dto';
import {
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('General Ledger')
@Controller('settings/cost-centers')
@CasbinResource(SystemResource.SETTINGS)
export class CostCentersController {
  constructor(private readonly service: CostCentersService) {}

  @Get()
  @ApiOkResponse({ type: [CostCenterResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List all cost centers',
    description: 'List all cost centers',
  })
  @ApiFieldMask()
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
  create(@Body() dto: CreateCostCenterDto, @AuthUser() user: JwtUser) {
    return this.service.create(dto, user?.userId);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateCostCenterDto })
  @ApiOkResponse({ type: CostCenterResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update a cost center',
    description: 'Update a cost center',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCostCenterDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user?.userId);
  }

  @Delete(':id')
  @ApiOkResponse({ type: CostCenterResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete a cost center',
    description: 'Delete a cost center',
  })
  delete(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.service.delete(id, user?.userId);
  }

  @Post('import')
  @ApiBody({ type: [CreateCostCenterDto] })
  @ApiCreatedResponse({ type: BulkImportResultDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Bulk import cost centers',
    description: 'Bulk import cost centers',
  })
  import(
    @Body() data: CreateCostCenterDto[],
    @AuthUser() user: JwtUser,
  ): Promise<BulkImportResultDto> {
    return this.service.importMany(data, user?.userId);
  }
}
