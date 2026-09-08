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
  ApiBody,
} from '@nestjs/swagger';
import { OpportunitiesService } from './opportunities.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  OpportunityResponseDto,
  CreateOpportunityNoteDto,
  OpportunityNoteResponseDto,
  CreateOpportunityContactDto,
  UpdateOpportunityContactDto,
  CreateOpportunityOrganizationDto,
  UpdateOpportunityOrganizationDto,
  EmptyBodyDto,
  SuccessResponseDto,
  OpportunityQueryDto,
} from './dto';
import { ApiPaginatedResponse } from '../common/pagination';
import { SystemResource } from '@herobm/shared';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';

@ApiTags('Opportunities')
@Controller('opportunities')
@CasbinResource(SystemResource.CRM)
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Opportunity',
    description: 'Create Opportunity',
  })
  @ApiCreatedResponse({ type: OpportunityResponseDto })
  create(@Body() dto: CreateOpportunityDto, @AuthUser() user: JwtUser) {
    return this.opportunitiesService.createOpportunity(dto, user.userId);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get all Opportunities',
    description: 'Get all Opportunities with filtering and pagination',
  })
  @ApiPaginatedResponse(OpportunityResponseDto)
  findAll(@Query() query: OpportunityQueryDto) {
    return this.opportunitiesService.getOpportunities(query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Opportunity by ID',
    description:
      'Get Opportunity by ID with linked organizations, contacts, and notes',
  })
  @ApiOkResponse({ type: OpportunityResponseDto })
  findOne(@Param('id') id: string) {
    return this.opportunitiesService.getOpportunity(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Opportunity',
    description: 'Update Opportunity',
  })
  @ApiOkResponse({ type: OpportunityResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.updateOpportunity(id, dto, user.userId);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Opportunity',
    description: 'Archives an opportunity',
  })
  @ApiOkResponse({ type: OpportunityResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  archive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.archiveOpportunity(id, user.userId);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Opportunity',
    description: 'Unarchives an opportunity',
  })
  @ApiOkResponse({ type: OpportunityResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  unarchive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.unarchiveOpportunity(id, user.userId);
  }

  @Delete(':id')
  @CasbinAction('delete')
  @ApiOperation({
    summary: 'Delete Opportunity',
    description: 'Deletes an opportunity permanently',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.opportunitiesService.deleteOpportunity(id, user.userId);
  }

  // --- Sub-resources: Notes ---

  @Post(':id/notes')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Opportunity Note',
    description: 'Adds a note to an opportunity',
  })
  @ApiCreatedResponse({ type: OpportunityNoteResponseDto })
  addNote(
    @Param('id') id: string,
    @Body() dto: CreateOpportunityNoteDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.addOpportunityNote(id, dto, user.userId);
  }

  @Get(':id/notes')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Opportunity Notes',
    description: 'Gets all notes for an opportunity',
  })
  @ApiOkResponse({ type: [OpportunityNoteResponseDto] })
  getNotes(@Param('id') id: string) {
    return this.opportunitiesService.getOpportunityNotes(id);
  }

  @Delete(':id/notes/:noteId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Opportunity Note',
    description: 'Deletes a note from an opportunity',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  deleteNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.deleteOpportunityNote(
      id,
      noteId,
      user.userId,
    );
  }

  // --- Sub-resources: Contacts ---

  @Post(':id/contacts')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Opportunity Contact',
    description: 'Links a contact to an opportunity',
  })
  @ApiCreatedResponse({ type: SuccessResponseDto })
  addContact(
    @Param('id') id: string,
    @Body() dto: CreateOpportunityContactDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.addOpportunityContact(
      id,
      dto,
      user.userId,
    );
  }

  @Patch(':id/contacts/:contactId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Opportunity Contact Roles',
    description: 'Updates roles for a linked contact',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateOpportunityContactDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.updateOpportunityContact(
      id,
      contactId,
      dto,
      user.userId,
    );
  }

  @Delete(':id/contacts/:contactId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Opportunity Contact',
    description: 'Unlinks a contact from an opportunity',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  deleteContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.deleteOpportunityContact(
      id,
      contactId,
      user.userId,
    );
  }

  // --- Sub-resources: Organizations ---

  @Post(':id/organizations')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Opportunity Organization',
    description: 'Links an organization to an opportunity',
  })
  @ApiCreatedResponse({ type: SuccessResponseDto })
  addOrganization(
    @Param('id') id: string,
    @Body() dto: CreateOpportunityOrganizationDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.addOpportunityOrganization(
      id,
      dto,
      user.userId,
    );
  }

  @Patch(':id/organizations/:organizationId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Opportunity Organization Roles',
    description: 'Updates roles for a linked organization',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  updateOrganization(
    @Param('id') id: string,
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOpportunityOrganizationDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.updateOpportunityOrganization(
      id,
      organizationId,
      dto,
      user.userId,
    );
  }

  @Delete(':id/organizations/:organizationId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Opportunity Organization',
    description: 'Unlinks an organization from an opportunity',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  deleteOrganization(
    @Param('id') id: string,
    @Param('organizationId') organizationId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.opportunitiesService.deleteOpportunityOrganization(
      id,
      organizationId,
      user.userId,
    );
  }
}
