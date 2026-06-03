import { SystemResource, SALES_CREDIT_NOTE_STATE } from '@modbm/shared';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBody,
} from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SalesCreditNoteService } from './sales-credit-note.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { CreateSalesCreditNoteDto } from './sales-credit-notes.dto';

export class EmptyBodyDto {}

@Controller('sales-credit-notes')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SALES_CREDIT_NOTES)
@ApiTags('SalesCreditNotes')
export class SalesCreditNotesController {
  constructor(private readonly creditNoteService: SalesCreditNoteService) {}

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Credit Note',
    description: 'Retrieve a sales credit note by ID.',
  })
  @ApiOkResponse({
    description: 'The requested credit note',
    schema: { type: 'object' },
  })
  findOne(@Param('id') id: string) {
    return this.creditNoteService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateSalesCreditNoteDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create Credit Note',
    description: 'Create a credit note from a return.',
  })
  @ApiCreatedResponse({
    description: 'Created Credit Note',
    schema: { type: 'object' },
  })
  createCreditNote(
    @Body() body: CreateSalesCreditNoteDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.creditNoteService.createCreditNote(
      body.returnId,
      user.username,
    );
  }

  @Post(':id/post')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Post Credit Note',
    description: 'Post an existing credit note.',
  })
  @ApiOkResponse({
    description: 'Posted Credit Note',
    schema: { type: 'object' },
  })
  @ApiBody({ type: EmptyBodyDto })
  @HttpCode(200)
  postCreditNote(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    // Re-using state transition to match purchase debit notes style
    return this.creditNoteService.changeCreditNoteState(
      id,
      SALES_CREDIT_NOTE_STATE.POSTED,
      user.username,
    );
  }
}
