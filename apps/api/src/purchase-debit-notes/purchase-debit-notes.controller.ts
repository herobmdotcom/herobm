import { SystemResource, DATA_SOURCE_CONTEXT } from '@herobm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseDebitNotesService } from './purchase-debit-notes.service';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { EntityType } from '../common/event-types';
import {
  CreateDebitNoteDto,
  PurchaseDebitNoteResponseDto,
  EmptyBodyDto,
  EmailDocumentDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@Controller('purchase-debit-notes')
@CasbinResource(SystemResource.PURCHASE_DEBIT_NOTES)
@ApiTags('Purchase Invoices')
export class PurchaseDebitNotesController {
  constructor(
    private readonly debitNotesService: PurchaseDebitNotesService,
    private readonly documentDispatchService: DocumentDispatchService,
  ) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Debit Notes',
    description: 'Retrieve a list of purchase debit notes.',
  })
  @ApiQuery({ name: 'vendorId', required: false })
  @ApiQuery({ name: 'balanceStatus', required: false })
  @ApiOkResponse({ type: [PurchaseDebitNoteResponseDto] })
  findAll(
    @Query('vendorId') vendorId?: string,
    @Query('balanceStatus') balanceStatus?: string,
  ) {
    return this.debitNotesService.findAll(vendorId, balanceStatus);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Debit Note',
    description: 'Retrieve a purchase debit note by ID.',
  })
  @ApiOkResponse({ type: PurchaseDebitNoteResponseDto })
  findOne(@Param('id') id: string) {
    return this.debitNotesService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateDebitNoteDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Debit Note',
    description: 'Create a new purchase debit note.',
  })
  @ApiCreatedResponse({ type: PurchaseDebitNoteResponseDto })
  createDebitNote(@Body() body: CreateDebitNoteDto, @AuthUser() user: JwtUser) {
    return this.debitNotesService.createDebitNote(body, user.username);
  }

  @Post(':id/post')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Post Debit Note',
    description: 'Post an existing debit note.',
  })
  @ApiOkResponse({ type: PurchaseDebitNoteResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  @HttpCode(200)
  postDebitNote(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.debitNotesService.postDebitNote(id, user.username);
  }

  @Post(':id/email-document')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Email Purchase Debit Note Document',
    description:
      'Generates a PDF using the active purchase debit note template/hook and queues an email outbox message to the specified recipient.',
  })
  @ApiCreatedResponse({
    description: 'Email queued successfully.',
    schema: { type: 'object', properties: { success: { type: 'boolean' } } },
  })
  async emailDocument(
    @Param('id') id: string,
    @Body() dto: EmailDocumentDto,
    @AuthUser() user: JwtUser,
  ) {
    const dn = await this.debitNotesService.findOne(id);
    if (!dn) {
      throw new NotFoundException(`Debit Note '${id}' not found`);
    }

    const hookSlug = dto.hookSlug || 'purchase-debit-note';

    return this.documentDispatchService.emailDocument(
      {
        targetId: dto.targetId || id,
        hookSlug,
        contextSlug: dto.contextSlug || DATA_SOURCE_CONTEXT.PURCHASE_DEBIT_NOTE,
        entityType: EntityType.PURCHASE_ORDER,
        entityId: dn.purchaseOrderId || id,
        emailAddress: dto.emailAddress,
        subject: dto.subject,
        body: dto.body,
        customPdfText: dto.customPdfText,
        fallbackFileName: `DebitNote-${dn.debitNoteNumber}.pdf`,
      },
      user,
    );
  }
}
