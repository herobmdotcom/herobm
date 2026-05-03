import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import { CreateUserDto, UpdateUserDto } from './dto';

@Controller('users')
@UseGuards(AuthGuard('jwt'), CasbinGuard)
@CasbinResource('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CasbinAction('read')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  create(@AuthUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(dto, user.username);
  }

  @Patch(':id')
  @CasbinAction('write')
  update(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto, user.userId, user.username);
  }

  @Patch(':id/toggle-active')
  @CasbinAction('write')
  toggleActive(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.usersService.toggleActive(id, user.userId, user.username);
  }

  @Delete(':id')
  @CasbinAction('write')
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.usersService.remove(id, user.userId, user.username);
  }
}
