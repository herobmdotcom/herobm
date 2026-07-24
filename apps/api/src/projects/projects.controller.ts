import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
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
} from './dto';
import { SystemResource } from '@herobm/shared';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.CRM)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({ summary: 'Create Project' })
  @ApiCreatedResponse({ type: ProjectResponseDto })
  create(@Body() dto: CreateProjectDto, @AuthUser() user: JwtUser) {
    return this.projectsService.createProject(dto, user.userId);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({ summary: 'Get all Projects' })
  @ApiOkResponse({ type: [ProjectResponseDto] })
  findAll() {
    return this.projectsService.getProjects();
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({ summary: 'Get Project by ID' })
  @ApiOkResponse({ type: ProjectResponseDto })
  findOne(@Param('id') id: string) {
    return this.projectsService.getProject(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Update Project' })
  @ApiOkResponse({ type: ProjectResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.updateProject(id, dto, user.userId);
  }

  @Post(':id/notes')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Add Note to Project' })
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
  @ApiOperation({ summary: 'Delete Note from Project' })
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
  @ApiOperation({ summary: 'Add Contact to Project' })
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
  @ApiOperation({ summary: 'Remove Contact from Project' })
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
  @ApiOperation({ summary: 'Update Contact Role on Project' })
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
  @ApiOperation({ summary: 'Add Actor to Project' })
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
  @ApiOperation({ summary: 'Update Actor Role on Project' })
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
  @ApiOperation({ summary: 'Remove Actor from Project' })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  removeActor(
    @Param('id') id: string,
    @Param('actorId') actorId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.projectsService.removeActor(id, actorId, user.userId);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Delete Project' })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.projectsService.deleteProject(id, user.userId);
  }
}
