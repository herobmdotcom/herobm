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
import { ActorsService } from './actors.service';
import {
  CreateActorDto,
  UpdateActorDto,
  ActorResponseDto,
  ActorNoteResponseDto,
  UpdateActorContactDto,
  CreateActorContactDto,
  CreateActorNoteDto,
  CreateActorLinkDto,
  ActorLinkResponseDto,
  EmptyBodyDto,
  SuccessResponseDto,
  ActorQueryDto,
} from './dto';
import { ApiPaginatedResponse } from '../common/pagination';
import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';
import { SystemResource } from '@herobm/shared';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';

@ApiTags('Actors')
@Controller('actors')
@CasbinResource(SystemResource.CRM)
export class ActorsController {
  constructor(private readonly actorsService: ActorsService) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({ summary: 'Create Actor', description: 'Create Actor' })
  @ApiCreatedResponse({ type: ActorResponseDto })
  create(@Body() dto: CreateActorDto, @AuthUser() user: JwtUser) {
    return this.actorsService.createActor(dto, user.userId);
  }

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get all Actors (paginated)',
    description: 'Get all Actors (paginated)',
  })
  @ApiFieldMask()
  @ApiPaginatedResponse(ActorResponseDto)
  findAll(@Query() query: ActorQueryDto) {
    return this.actorsService.getActors(query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({ summary: 'Get Actor by ID', description: 'Get Actor by ID' })
  @ApiOkResponse({ type: ActorResponseDto })
  findOne(@Param('id') id: string) {
    return this.actorsService.getActor(id);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({ summary: 'Update Actor', description: 'Update Actor' })
  @ApiOkResponse({ type: ActorResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateActorDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.updateActor(id, dto, user.userId);
  }

  @Patch(':id/contacts/:contactId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Contact Link on Actor',
    description: 'Update Contact Link on Actor',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateActorContactDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.updateContact(id, contactId, dto, user.userId);
  }

  @Post(':id/contacts')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Link Contact to Actor',
    description: 'Link Contact to Actor',
  })
  @ApiCreatedResponse({ type: SuccessResponseDto })
  addContact(
    @Param('id') id: string,
    @Body() dto: CreateActorContactDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.addContact(id, dto, user.userId);
  }

  @Delete(':id')
  @CasbinAction('delete')
  @ApiOperation({ summary: 'Delete Actor', description: 'Delete Actor' })
  @ApiOkResponse({ type: SuccessResponseDto })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.actorsService.deleteActor(id, user.userId);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  @ApiOperation({ summary: 'Archive Actor', description: 'Archives an actor' })
  @ApiOkResponse({ type: ActorResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  archive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.archiveActor(id, user.userId);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Actor',
    description: 'Unarchives an actor',
  })
  @ApiOkResponse({ type: ActorResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  unarchive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.unarchiveActor(id, user.userId);
  }

  @Post(':id/notes')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Note to Actor',
    description: 'Add Note to Actor',
  })
  @ApiCreatedResponse({ type: ActorNoteResponseDto })
  addNote(
    @Param('id') id: string,
    @Body() dto: CreateActorNoteDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.addNote(id, dto, user.userId);
  }

  @Delete(':id/notes/:noteId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Note from Actor',
    description: 'Remove Note from Actor',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  removeNote(
    @Param('id') id: string,
    @Param('noteId') noteId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.removeNote(id, noteId, user.userId);
  }

  @Delete(':id/contacts/:contactId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Contact Link from Actor',
    description: 'Remove Contact Link from Actor',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  removeContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.removeContact(id, contactId, user.userId);
  }

  @Get(':id/links')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Actor Links',
    description:
      'Retrieve corporate links (parent, subsidiary, partner, referrer) for an actor.',
  })
  @ApiOkResponse({ type: [ActorLinkResponseDto] })
  getLinks(@Param('id') id: string) {
    return this.actorsService.getActorLinks(id);
  }

  @Post(':id/links')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Add Actor Link',
    description:
      'Create a link to another actor (parent, subsidiary, partner, referrer).',
  })
  @ApiCreatedResponse({ type: ActorLinkResponseDto })
  addLink(
    @Param('id') id: string,
    @Body() dto: CreateActorLinkDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.addActorLink(id, dto, user.userId);
  }

  @Delete(':id/links/:linkId')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Remove Actor Link',
    description: 'Remove an actor link.',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  removeLink(
    @Param('id') id: string,
    @Param('linkId') linkId: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.actorsService.removeActorLink(id, linkId, user.userId);
  }
}
