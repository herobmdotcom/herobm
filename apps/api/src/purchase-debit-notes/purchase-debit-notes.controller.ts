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
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('purchase-debit-notes')
@ApiTags('PurchaseDebitNotes')
export class PurchaseDebitNotesController {
  constructor(private readonly debitNotesService: PurchaseDebitNotesService) {}

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
