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
import { ActivitiesService } from './activities.service';
import {
  CreateActivityDto,
  UpdateActivityDto,
  BulkImportResultDto,
  ActivityResponseDto,
} from './dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('System')
@Controller('settings/activities')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @ApiOkResponse({ type: [ActivityResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List all activities',
    description: 'List all activities',
  })
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
  create(@Body() dto: CreateActivityDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateActivityDto })
  @ApiOkResponse({ type: ActivityResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update an activity',
    description: 'Update an activity',
  })
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: ActivityResponseDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete an activity',
    description: 'Delete an activity',
  })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post('import')
  @ApiBody({ type: [CreateActivityDto] })
  @ApiCreatedResponse({ type: BulkImportResultDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Bulk import activities',
    description: 'Bulk import activities',
  })
  import(@Body() data: CreateActivityDto[]): Promise<BulkImportResultDto> {
    return this.service.importMany(data);
  }
}
