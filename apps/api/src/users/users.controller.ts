import { SystemResource } from '@herobm/shared';
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
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ApiPaginatedResponse } from '../common/pagination';
import { UsersService } from './users.service';
import {
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { AuthUser } from '../auth/auth-user.decorator';
import type { JwtUser } from '../auth/auth-user.decorator';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  EmptyBodyDto,
} from './dto';

import { ApiFieldMask } from '../common/decorators/api-field-mask.decorator';

@ApiTags('System')
@Controller('users')
@CasbinResource(SystemResource.USERS)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOkResponse({ type: [UserResponseDto] })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'List Users',
    description: 'Retrieves a paginated list of all system users.',
  })
  @ApiPaginatedResponse(UserResponseDto)
  @ApiFieldMask()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get User',
    description: 'Retrieves a single user by their unique identifier.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiFieldMask()
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateUserDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Create User',
    description: 'Provisions a new user account in the system.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  create(@AuthUser() user: JwtUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(dto, user.username);
  }

  @Patch(':id')
  @ApiBody({ type: UpdateUserDto })
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Update User',
    description: 'Modifies an existing user profile or permissions.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  update(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto, user.userId, user.username);
  }

  @Patch(':id/toggle-active')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Toggle User Status',
    description: 'Activates or deactivates a user account.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiBody({ type: EmptyBodyDto })
  toggleActive(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ) {
    return this.usersService.toggleActive(id, user.userId, user.username);
  }

  @Delete(':id')
  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete User',
    description: 'Permanently removes a user from the system.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  remove(@Param('id') id: string, @AuthUser() user: JwtUser) {
    return this.usersService.remove(id, user.userId, user.username);
  }
}
