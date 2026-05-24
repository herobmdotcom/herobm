import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PurchaseDebitNotesService } from './purchase-debit-notes.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { CreateDebitNoteDto } from './dto';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';

@Controller('purchase-debit-notes')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('purchase-debit-notes')
export class PurchaseDebitNotesController {
  constructor(private readonly debitNotesService: PurchaseDebitNotesService) {}

  @Post()
  @CasbinAction('write')
  createDebitNote(@Body() body: CreateDebitNoteDto, @AuthUser() user: JwtUser) {
    return this.debitNotesService.createDebitNote(body, user.username);
  }

  @Post(':id/post')
  @CasbinAction('write')
  postDebitNote(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.debitNotesService.postDebitNote(id, user.username);
  }
}
