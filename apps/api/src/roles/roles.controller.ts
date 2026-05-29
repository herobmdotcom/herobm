import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CasbinGuard, CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { RolesService } from './roles.service';
import { SetRolePermissionsDto, RoleDetailsDto, SuccessResponseDto } from './dto';
import { ApiOkResponse, ApiCreatedResponse } from '@nestjs/swagger';

@UseGuards(CasbinGuard)
@CasbinResource('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @CasbinAction('read')
  @ApiOkResponse({ type: [RoleDetailsDto] })
  @Get()
  async findAll() {
    return this.rolesService.findAllRoles();
  }

  @CasbinAction('read')
  @ApiOkResponse({ type: RoleDetailsDto })
  @Get(':role')
  async findOne(@Param('role') role: string) {
    const details = await this.rolesService.getRoleDetails(role);
    return { role, ...details };
  }

  @CasbinAction('write')
  @ApiCreatedResponse({ type: RoleDetailsDto })
  @Post(':role')
  async setPermissions(
    @Param('role') role: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setRolePermissions(role, dto);
  }

  @CasbinAction('write')
  @ApiOkResponse({ type: SuccessResponseDto })
  @Delete(':role')
  async remove(@Param('role') role: string) {
    return this.rolesService.deleteRole(role);
  }
}
