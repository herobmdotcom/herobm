import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  CasbinGuard,
  CasbinResource,
  CasbinAction,
} from '../auth/casbin.guard';
import { RolesService } from './roles.service';
import { SetRolePermissionsDto } from './dto';

@UseGuards(CasbinGuard)
@CasbinResource('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @CasbinAction('read')
  @Get()
  async findAll() {
    return this.rolesService.findAllRoles();
  }

  @CasbinAction('read')
  @Get(':role')
  async findOne(@Param('role') role: string) {
    const permissions = await this.rolesService.getRolePermissions(role);
    return { role, permissions };
  }

  @CasbinAction('write')
  @Post(':role')
  async setPermissions(
    @Param('role') role: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setRolePermissions(role, dto);
  }

  @CasbinAction('write')
  @Delete(':role')
  async remove(@Param('role') role: string) {
    return this.rolesService.deleteRole(role);
  }
}
