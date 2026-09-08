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
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationResponseDto,
  OrganizationNoteResponseDto,
  UpdateOrganizationContactDto,
  CreateOrganizationContactDto,
  CreateOrganizationNoteDto,
  CreateOrganizationLinkDto,
  OrganizationLinkResponseDto,
  EmptyBodyDto,
  SuccessResponseDto,
  OrganizationQueryDto,
} from './dto';
import { ApiPaginatedResponse } from '../common/pagination';
import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';
import { SystemResource } from '@herobm/shared';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';

@ApiTags('Organizations')
@Controller('organizations')
@CasbinResource(SystemResource.CRM)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Organization',
    description: 'Create Organization',
  })
  @ApiCreatedResponse({ type: OrganizationResponseDto })
  create(@Body() dto: CreateOrganizationDto, @AuthUser() user: JwtUser) {
    return this.organizationsService.createOrganization(dto, user.userId);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get all Organizations (paginated)',
    description: 'Get all Organizations (paginated)',
  })
  @ApiFieldMask()
  @ApiPaginatedResponse(OrganizationResponseDto)
  findAll(@Query() query: OrganizationQueryDto) {
    return this.organizationsService.getOrganizations(query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Organization by ID',
    description: 'Get Organization by ID',
  })
  @ApiOkResponse({ type: OrganizationResponseDto })
  findOne(@Param('id') id: string) {
    return this.organizationsService.getOrganization(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Organization',
    description: 'Update Organization',
  })
  @ApiOkResponse({ type: OrganizationResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.updateOrganization(id, dto, user.userId);
  }

  @Patch(':id/contacts/:contactId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Contact Link on Organization',
    description: 'Update Contact Link on Organization',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateOrganizationContactDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.updateContact(
      id,
      contactId,
      dto,
      user.userId,
    );
  }

  @Post(':id/contacts')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Link Contact to Organization',
    description: 'Link Contact to Organization',
  })
  @ApiCreatedResponse({ type: SuccessResponseDto })
  addContact(
    @Param('id') id: string,
    @Body() dto: CreateOrganizationContactDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.addContact(id, dto, user.userId);
  }

  @Delete(':id/contacts/:contactId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Contact Link from Organization',
    description: 'Remove Contact Link from Organization',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  removeContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.removeContact(id, contactId, user.userId);
  }

  @Delete(':id')
  @CasbinAction('delete')
  @ApiOperation({
    summary: 'Delete Organization',
    description: 'Delete Organization',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.organizationsService.deleteOrganization(id, user.userId);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Organization',
    description: 'Archives an organization',
  })
  @ApiOkResponse({ type: OrganizationResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  archive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.archiveOrganization(id, user.userId);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Organization',
    description: 'Unarchives an organization',
  })
  @ApiOkResponse({ type: OrganizationResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  unarchive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.unarchiveOrganization(id, user.userId);
  }

  @Post(':id/notes')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Note to Organization',
    description: 'Add Note to Organization',
  })
  @ApiCreatedResponse({ type: OrganizationNoteResponseDto })
  addNote(
    @Param('id') id: string,
    @Body() dto: CreateOrganizationNoteDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.addNote(id, dto, user.userId);
  }

  @Delete(':id/notes/:noteId')
  @CasbinAction('delete')
  @ApiOperation({
    summary: 'Remove Note from Organization',
    description: 'Remove Note from Organization',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  removeNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.removeNote(id, noteId, user.userId);
  }

  @Get(':id/links')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Organization Links',
    description: 'Get Organization Links',
  })
  @ApiOkResponse({ type: [OrganizationLinkResponseDto] })
  getLinks(@Param('id') id: string) {
    return this.organizationsService.getOrganizationLinks(id);
  }

  @Post(':id/links')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Organization Link',
    description: 'Add Organization Link',
  })
  @ApiCreatedResponse({ type: OrganizationLinkResponseDto })
  addLink(
    @Param('id') id: string,
    @Body() dto: CreateOrganizationLinkDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.addOrganizationLink(id, dto, user.userId);
  }

  @Delete(':id/links/:linkId')
  @CasbinAction('delete')
  @ApiOperation({
    summary: 'Remove Organization Link',
    description: 'Remove Organization Link',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  removeLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.organizationsService.removeOrganizationLink(
      id,
      linkId,
      user.userId,
    );
  }
}

export const ActorsController = OrganizationsController;
