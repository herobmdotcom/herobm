import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Post,
  Patch,
  Body,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './accounts.service';
import { AccountsWriteService } from './accounts-write.service';
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
  constructor(
    private readonly accountsService: AccountsService,
    private readonly accountsWriteService: AccountsWriteService,
  ) {}

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

  @Post()
  @CasbinAction('write')
  create(@Body() dto: any, @Req() req: any) {
    return this.accountsWriteService.create(dto, req.user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.accountsWriteService.update(id, dto, req.user.username);
  }

  @Post(':id/archive')
  @CasbinAction('archive')
  archive(@Param('id') id: string, @Req() req: any) {
    return this.accountsWriteService.archive(id, req.user.username);
  }

  @Post(':id/unarchive')
  @CasbinAction('archive')
  unarchive(@Param('id') id: string, @Req() req: any) {
    return this.accountsWriteService.unarchive(id, req.user.username);
  }
}
