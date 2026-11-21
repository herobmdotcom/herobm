import { SystemResource } from '@herobm/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import type { JwtUser } from '../auth/auth-user.decorator';
import { AuthUser } from '../auth/auth-user.decorator';
import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';
import { ApiPaginatedResponse, PaginationQuery } from '../common/pagination';
import { ContactsService } from './contacts.service';
import {
  ContactResponseDto,
  CreateContactDto,
  EmptyBodyDto,
  SuccessResponseDto,
  UpdateContactDto,
} from './dto';

import { CasbinAction, CasbinResource } from '../auth/casbin.guard';

@ApiTags('Contacts')
@Controller('contacts')
@CasbinResource((req: Request) => {
  const entityType = req.body?.entityType || req.query?.entityType;
  return entityType === 'supplier'
    ? SystemResource.SUPPLIERS
    : SystemResource.CRM;
})
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Contacts',
    description: 'Retrieve a paginated list of contacts.',
  })
  @ApiFieldMask()
  @ApiPaginatedResponse(ContactResponseDto)
  findAll(@Query() query: PaginationQuery) {
    return this.contactsService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Contact',
    description: 'Retrieve a single contact by ID.',
  })
  @ApiOkResponse({ type: ContactResponseDto })
  findOne(@Param('id') id: string) {
    return this.contactsService.getContact(id);
  }

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Contact',
    description: 'Create a new contact for a given entity.',
  })
  @ApiCreatedResponse({ type: ContactResponseDto })
  create(@Body() dto: CreateContactDto, @AuthUser() user: JwtUser) {
    return this.contactsService.createContact(dto, user.userId);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Contact',
    description: 'Update an existing contact.',
  })
  @ApiOkResponse({ type: ContactResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.contactsService.updateContact(id, dto, user.userId);
  }

  @Delete(':id')
  @CasbinAction('delete')
  @ApiOperation({
    summary: 'Delete Contact',
    description: 'Hard delete an existing contact.',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.contactsService.deleteContact(id, user.userId);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Archive Contact',
    description: 'Archives a contact',
  })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  archive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.contactsService.archiveContact(id, user.userId);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  @ApiOperation({
    summary: 'Unarchive Contact',
    description: 'Unarchives a contact',
  })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  unarchive(
    @Param('id') id: string,
    @Body() _dto: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.contactsService.unarchiveContact(id, user.userId);
  }
}
