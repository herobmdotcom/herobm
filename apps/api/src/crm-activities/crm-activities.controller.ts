import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { SystemResource } from '@herobm/shared';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { ApiPaginatedResponse } from '../common/pagination';
import { CrmActivitiesService } from './crm-activities.service';
import {
  CreateCrmActivityDto,
  UpdateCrmActivityDto,
  CrmActivityQueryDto,
  CrmActivityResponseDto,
  EmptyBodyDto,
} from './dto';

@ApiTags('CRM Activities')
@ApiBearerAuth()
@Controller('crm-activities')
@CasbinResource(SystemResource.CRM)
export class CrmActivitiesController {
  constructor(private readonly crmActivitiesService: CrmActivitiesService) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create CRM Activity',
    description:
      'Logs a new interaction (Call, Meeting, Email, Task) against an Actor, Contact, or Project.',
  })
  @ApiCreatedResponse({ type: CrmActivityResponseDto })
  create(@Body() dto: CreateCrmActivityDto, @AuthUser() user: JwtUser) {
    return this.crmActivitiesService.create(dto, user);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List CRM Activities',
    description:
      'Retrieves CRM activities and tasks with filtering by entity, assignee, and status.',
  })
  @ApiPaginatedResponse(CrmActivityResponseDto)
  findAll(@Query() query: CrmActivityQueryDto, @AuthUser() user: JwtUser) {
    return this.crmActivitiesService.findAll(query, user.userId);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get CRM Activity',
    description: 'Retrieves a single CRM activity by unique identifier.',
  })
  @ApiOkResponse({ type: CrmActivityResponseDto })
  findOne(@Param('id') id: string) {
    return this.crmActivitiesService.findOne(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update CRM Activity',
    description: 'Modifies an existing interaction or task.',
  })
  @ApiOkResponse({ type: CrmActivityResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCrmActivityDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.crmActivitiesService.update(id, dto, user);
  }

  @Patch(':id/complete')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Complete Task',
    description: 'Quickly marks a CRM task as completed.',
  })
  @ApiBody({ type: EmptyBodyDto })
  @ApiOkResponse({ type: CrmActivityResponseDto })
  complete(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.crmActivitiesService.complete(id, user);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete CRM Activity',
    description: 'Permanently removes a CRM activity or task.',
  })
  @ApiOkResponse({ schema: { properties: { success: { type: 'boolean' } } } })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.crmActivitiesService.remove(id, user);
  }
}
