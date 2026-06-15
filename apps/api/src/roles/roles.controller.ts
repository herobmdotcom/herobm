import { SystemResource } from '@herobm/shared';
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
import {
  SetRolePermissionsDto,
  RoleDetailsDto,
  RolesSuccessResponseDto,
} from './dto';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';

@ApiTags('System')
@UseGuards(CasbinGuard)
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
