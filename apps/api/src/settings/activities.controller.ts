// security-ignore: dto-validation
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

@ApiTags('System')
@Controller('settings/activities')
@CasbinResource(SystemResource.SETTINGS)
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @ApiOkResponse({ type: [ActivityResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List all activities',
    description: 'List all activities',
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
    summary: 'Create a new activity',
    description: 'Create a new activity',
  })
  create(@Body() dto: CreateActivityDto, @AuthUser() user: JwtUser) {
    return this.service.create(dto, user?.userId);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateActivityDto })
  @ApiOkResponse({ type: ActivityResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update an activity',
    description: 'Update an activity',
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
    summary: 'Delete an activity',
    description: 'Delete an activity',
  })
  delete(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.service.delete(id, user?.userId);
  }

  @Post('import')
  @ApiBody({ type: [CreateActivityDto] })
  @ApiCreatedResponse({ type: BulkImportResultDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Bulk import activities',
    description: 'Bulk import activities',
  })
  import(
    @Body() data: CreateActivityDto[],
    @AuthUser() user: JwtUser,
  ): Promise<BulkImportResultDto> {
    return this.service.importMany(data, user?.userId);
  }
}
