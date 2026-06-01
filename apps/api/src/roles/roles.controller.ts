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
  SuccessResponseDto,
} from './dto';
import {
  ApiOkResponse,
  ApiCreatedResponse,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';

@ApiTags('Roles')
@UseGuards(CasbinGuard)
@CasbinResource('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find all roles',
    description: 'Returns a list of all roles.',
  })
  @ApiOkResponse({ type: [RoleDetailsDto] })
  @Get()
  async findAll() {
    return this.rolesService.findAllRoles();
  }

  @CasbinAction('read')
  @ApiOperation({
    summary: 'Get role details',
    description: 'Returns details for a specific role.',
  })
  @ApiOkResponse({ type: RoleDetailsDto })
  @Get(':role')
  async findOne(@Param('role') role: string) {
    const details = await this.rolesService.getRoleDetails(role);
    return { role, ...details };
  }

  @CasbinAction('write')
  @ApiOperation({
    summary: 'Set role permissions',
    description: 'Sets the permissions for a specific role.',
  })
  @ApiCreatedResponse({ type: RoleDetailsDto })
  @Post(':role')
  async setPermissions(
    @Param('role') role: string,
    @Body() dto: SetRolePermissionsDto,
  ) {
    return this.rolesService.setRolePermissions(role, dto);
  }

  @CasbinAction('write')
  @ApiOperation({
    summary: 'Delete role',
    description: 'Deletes a specific role.',
  })
  @ApiOkResponse({ type: SuccessResponseDto })
  @Delete(':role')
  async remove(@Param('role') role: string) {
    return this.rolesService.deleteRole(role);
  }
}
