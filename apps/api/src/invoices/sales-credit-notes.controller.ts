import { SystemResource, SALES_CREDIT_NOTE_STATE } from '@herobm/shared';
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
  UseGuards,
  HttpCode,
  Query,
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
import {
  CreateSalesCreditNoteDto,
  SalesCreditNoteResponseDto,
  EmptyBodyDto,
} from './sales-credit-notes.dto';

@Controller('sales-credit-notes')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.SALES_CREDIT_NOTES)
@ApiTags('Sales Returns')
export class SalesCreditNotesController {
  constructor(private readonly creditNoteService: SalesCreditNoteService) {}

  @Get()
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find Credit Notes',
    description: 'Retrieve a list of sales credit notes.',
  })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'balanceStatus', required: false })
  @ApiOkResponse({ type: [SalesCreditNoteResponseDto] })
  findAll(
    @Query('customerId') customerId?: string,
    @Query('balanceStatus') balanceStatus?: string,
  ) {
    return this.creditNoteService.findAll(customerId, balanceStatus);
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get Credit Note',
    description: 'Retrieve a sales credit note by ID.',
  })
  @ApiOkResponse({
    description: 'The requested credit note',
    type: SalesCreditNoteResponseDto,
  })
  findOne(@Param('id') id: string) {
    return this.creditNoteService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateSalesCreditNoteDto })
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Create Credit Note',
    description: 'Create a credit note from a return.',
  })
  @ApiCreatedResponse({
    description: 'Created Credit Note',
    type: SalesCreditNoteResponseDto,
  })
  createCreditNote(
    @Body() body: CreateSalesCreditNoteDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.creditNoteService.createCreditNote(body, user.username);
  }

  @Post(':id/post')
  @CasbinAction('invoice')
  @ApiOperation({
    summary: 'Post Credit Note',
    description: 'Post an existing credit note.',
  })
  @ApiOkResponse({
    description: 'Posted Credit Note',
    type: SalesCreditNoteResponseDto,
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
