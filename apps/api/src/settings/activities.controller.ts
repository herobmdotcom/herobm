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
} from './dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('Settings')
@Controller('settings/activities')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({ summary: 'List all activities' })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({ summary: 'Create a new activity' })
  create(@Body() dto: CreateActivityDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Update an activity' })
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Delete an activity' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post('import')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Bulk import activities' })
  import(@Body() data: CreateActivityDto[]): Promise<BulkImportResultDto> {
    return this.service.importMany(data);
  }
}
