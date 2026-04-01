import {
  Controller,
  Get,
  Param,
  UseGuards,
  Post,
  Patch,
  Body,
  Delete,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AccountGroupsService } from './account-groups.service';
import { CreateAccountGroupDto, UpdateAccountGroupDto } from './dto';

@Controller('account-groups')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('settings')
export class AccountGroupsController {
  constructor(private readonly accountGroupsService: AccountGroupsService) {}

  @Get()
  @CasbinAction('read')
  findAll() {
    return this.accountGroupsService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.accountGroupsService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  create(@Body() dto: CreateAccountGroupDto) {
    return this.accountGroupsService.create(dto);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(@Param('id') id: string, @Body() dto: UpdateAccountGroupDto) {
    return this.accountGroupsService.update(id, dto);
  }

  @Delete(':id')
  @CasbinAction('write')
  remove(@Param('id') id: string) {
    return this.accountGroupsService.delete(id);
  }
}
