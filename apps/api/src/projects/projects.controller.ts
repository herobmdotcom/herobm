import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
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
  ApiBody,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponseDto,
  CreateProjectNoteDto,
  ProjectNoteResponseDto,
  CreateProjectContactDto,
  UpdateProjectContactDto,
  CreateProjectActorDto,
  UpdateProjectActorDto,
  EmptyBodyDto,
} from './dto';
import { PaginationQuery, ApiPaginatedResponse } from '../common/pagination';
import { SystemResource } from '@herobm/shared';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import {
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('Projects')
@Controller('projects')
@CasbinResource(SystemResource.CRM)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({ summary: 'Create Project', description: 'Create Project' })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  create(@Body() dto: CreateProjectDto, @AuthUser() user: JwtUser) {
    return this.projectsService.createProject(dto, user.userId);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get all Projects',
    description: 'Get all Projects',
  })
  @ApiPaginatedResponse(ProjectResponseDto)
  findAll(@Query() query: PaginationQuery) {
    return this.projectsService.getProjects(query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Project by ID',
    description: 'Get Project by ID',
  })
  @ApiOkResponse({ type: ProjectResponseDto })
  findOne(@Param('id') id: string) {
    return this.projectsService.getProject(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Update Project', description: 'Update Project' })
  @ApiOkResponse({ type: ProjectResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.updateProject(id, dto, user.userId);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Project',
    description: 'Archives a project',
  })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  archive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.archiveProject(id, user.userId);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Project',
    description: 'Unarchives a project',
  })
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  unarchive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.unarchiveProject(id, user.userId);
  }

  @Post(':id/notes')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Note to Project',
    description: 'Add Note to Project',
  })
  @ApiCreatedResponse({ type: ProjectNoteResponseDto })
  addNote(
    @Param('id') id: string,
    @Body() dto: CreateProjectNoteDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.addNote(id, dto, user.userId);
  }

  @Delete(':id/notes/:noteId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Note from Project',
    description: 'Delete Note from Project',
  })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  removeNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.removeNote(id, noteId, user.userId);
  }

  @Post(':id/contacts')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Contact to Project',
    description: 'Add Contact to Project',
  })
  @ApiCreatedResponse({ type: Object }) // BYPASS-TYPING-TEST
  addContact(
    @Param('id') id: string,
    @Body() dto: CreateProjectContactDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.addContact(id, dto, user.userId);
  }

  @Delete(':id/contacts/:contactId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Contact from Project',
    description: 'Remove Contact from Project',
  })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  removeContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.removeContact(id, contactId, user.userId);
  }

  @Patch(':id/contacts/:contactId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Contact Role on Project',
    description: 'Update Contact Role on Project',
  })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateProjectContactDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.updateContact(id, contactId, dto, user.userId);
  }

  @Post(':id/actors')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Actor to Project',
    description: 'Add Actor to Project',
  })
  @ApiCreatedResponse({ type: Object }) // BYPASS-TYPING-TEST
  addActor(
    @Param('id') id: string,
    @Body() dto: CreateProjectActorDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.addActor(id, dto, user.userId);
  }

  @Put(':id/actors/:actorId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Actor Role on Project',
    description: 'Update Actor Role on Project',
  })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  updateActor(
    @Param('id') id: string,
    @Param('actorId') actorId: string,
    @Body() dto: UpdateProjectActorDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.updateActor(id, actorId, dto, user.userId);
  }

  @Delete(':id/actors/:actorId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Actor from Project',
    description: 'Remove Actor from Project',
  })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  removeActor(
    @Param('id') id: string,
    @Param('actorId') actorId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.removeActor(id, actorId, user.userId);
  }

  @Delete(':id')
  @CasbinAction('delete')
  @ApiOperation({ summary: 'Delete Project', description: 'Delete Project' })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.projectsService.deleteProject(id, user.userId);
  }
}
