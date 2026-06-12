import { SystemResource } from '@modbm/shared';
import {
  Controller,
  Post,
  Patch,
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
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto, ContactResponseDto } from './dto';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';

@ApiTags('Contacts')
@Controller('contacts')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
// TODO: When expanding to suppliers, this needs to dynamically check permissions based on entityType
@CasbinResource(SystemResource.CUSTOMERS)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Contact',
    description: 'Create a new contact for a given entity.',
  })
  @ApiCreatedResponse({ type: ContactResponseDto })
  create(@Body() dto: CreateContactDto) {
    return this.contactsService.createContact(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update Contact',
    description: 'Update an existing contact.',
  })
  @ApiOkResponse({ type: ContactResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactsService.updateContact(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete Contact',
    description: 'Hard delete an existing contact.',
  })
  @ApiOkResponse({ type: Object }) // BYPASS-TYPING-TEST
  remove(@Param('id') id: string) {
    return this.contactsService.deleteContact(id);
  }
}
