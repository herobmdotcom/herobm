import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './accounts.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { PaginationQuery } from '../common/pagination';

@Controller('accounts')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @CasbinAction('read')
  findAll(@Query() query: PaginationQuery) {
    return this.accountsService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }
}
