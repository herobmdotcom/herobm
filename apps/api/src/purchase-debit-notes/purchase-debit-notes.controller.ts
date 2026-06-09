import { SystemResource } from '@modbm/shared';
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
import { PurchaseDebitNotesService } from './purchase-debit-notes.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import {
  CreateDebitNoteDto,
  PurchaseDebitNoteResponseDto,
  EmptyBodyDto,
} from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@Controller('purchase-debit-notes')
@UseGuards(AuthGuard(['jwt', 'api-key']), CasbinGuard)
@CasbinResource(SystemResource.PURCHASE_DEBIT_NOTES)
@ApiTags('PurchaseDebitNotes')
export class PurchaseDebitNotesController {
  constructor(private readonly debitNotesService: PurchaseDebitNotesService) {}

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
  postDebitNote(
    @Param('id') id: string,
    @Body() body: EmptyBodyDto,
    @AuthUser() user: JwtUser,
  ) {
    return this.debitNotesService.postDebitNote(id, user.username);
  }
}
