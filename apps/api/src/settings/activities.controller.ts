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
import { ActivitiesService } from './activities.service';
import {
  CreateActivityDto,
  UpdateActivityDto,
  BulkImportResultDto,
  ActivityResponseDto,
} from './dto';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('General Ledger')
@Controller('settings/activities')
@CasbinResource(SystemResource.SETTINGS)
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @ApiOkResponse({ type: [ActivityResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List all General Ledger activities',
    description: 'List all General Ledger accounting dimension activities',
  })
  @ApiFieldMask()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @ApiBody({ type: CreateActivityDto })
  @ApiCreatedResponse({ type: ActivityResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create a new General Ledger activity',
    description: 'Create a new General Ledger accounting dimension activity',
  })
  create(@Body() dto: CreateActivityDto, @AuthUser() user: JwtUser) {
    return this.service.create(dto, user?.userId);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateActivityDto })
  @ApiOkResponse({ type: ActivityResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update a General Ledger activity',
    description: 'Update a General Ledger accounting dimension activity',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.service.update(id, dto, user?.userId);
  }

  @Delete(':id')
  @ApiOkResponse({ type: ActivityResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete a General Ledger activity',
    description: 'Delete a General Ledger accounting dimension activity',
  })
  delete(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.service.delete(id, user?.userId);
  }

  @Post('import')
  @ApiBody({ type: [CreateActivityDto] })
  @ApiCreatedResponse({ type: BulkImportResultDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Bulk import General Ledger activities',
    description: 'Bulk import General Ledger accounting dimension activities',
  })
  import(
    @Body() data: CreateActivityDto[],
    @AuthUser() user: JwtUser,
  ): Promise<BulkImportResultDto> {
    return this.service.importMany(data, user?.userId);
  }
}
