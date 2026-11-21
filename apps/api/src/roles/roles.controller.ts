import { SystemResource } from '@herobm/shared';
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CasbinAction, CasbinResource } from '../auth/casbin.guard';
import {
  RoleDetailsDto,
  RolesSuccessResponseDto,
  SetRolePermissionsDto,
} from './dto';
import { RolesService } from './roles.service';

@ApiTags('System')
@CasbinResource(SystemResource.ROLES)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @CasbinAction('read')
  @Get()
  @ApiOperation({
    summary: 'Find all roles',
    description: 'Returns a list of all roles.',
  })
  @ApiOkResponse({ type: [RoleDetailsDto] })
  async findAll() {
    return this.rolesService.findAllRoles();
  }

  @CasbinAction('read')
  @Get(':role')
  @ApiOperation({
    summary: 'Get role details',
    description: 'Returns details for a specific role.',
  })
  @ApiOkResponse({ type: RoleDetailsDto })
  async findOne(@Param('role') role: string) {
    const details = await this.rolesService.getRoleDetails(role);
    return { role, ...details };
  }

  @CasbinAction('write')
  @Post(':role')
  @ApiOperation({
    summary: 'Set role permissions',
    description: 'Sets the permissions for a specific role.',
  })
  @ApiCreatedResponse({ type: RoleDetailsDto })
  async setPermissions(
    @Param('role') role: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setRolePermissions(role, dto);
  }

  @CasbinAction('write')
  @Delete(':role')
  @ApiOperation({
    summary: 'Delete role',
    description: 'Deletes a specific role.',
  })
  @ApiOkResponse({ type: RolesSuccessResponseDto })
  async remove(@Param('role') role: string) {
    return this.rolesService.deleteRole(role);
  }
}
