import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Enforcer } from 'casbin';
import { CASBIN_ENFORCER } from '../auth/casbin.provider';
import { PermissionDto, SetRolePermissionsDto } from './dto';

@Injectable()
export class RolesService {
  constructor(@Inject(CASBIN_ENFORCER) private enforcer: Enforcer) {}

  async findAllRoles() {
    const subjects = await this.enforcer.getAllSubjects();
    const roles = await this.enforcer.getAllRoles();

    const groupingPolicies = await this.enforcer.getGroupingPolicy();
    const groupSubjects = groupingPolicies.map((p) => p[0]);

    const allRoles = new Set([...subjects, ...roles, ...groupSubjects]);

    const result = [];
    for (const r of allRoles) {
      result.push({
        role: r,
        ...(await this.getRoleDetails(r)),
      });
    }

    return result;
  }

  async getRoleDetails(role: string) {
    const localPolicies = await this.enforcer.getFilteredPolicy(0, role);
    const localPermissions = localPolicies.map((p) => ({
      resource: p[1],
      action: p[2],
      effect: p[3] || 'allow',
    }));

    const groupingPolicies = await this.enforcer.getFilteredGroupingPolicy(
      0,
      role,
    );
    const inherits = groupingPolicies.map((p) => p[1]);

    const implicitPolicies =
      await this.enforcer.getImplicitPermissionsForUser(role);
    const implicitPermissions = implicitPolicies.map((p) => ({
      sourceRole: p[0],
      resource: p[1],
      action: p[2],
      effect: p[3] || 'allow',
    }));

    return {
      permissions: localPermissions,
      inherits,
      implicitPermissions,
    };
  }

  async setRolePermissions(role: string, dto: SetRolePermissionsDto) {
    // 1. Remove all existing permissions for this role
    await this.enforcer.removeFilteredPolicy(0, role);

    // 2. Add new permissions
    for (const p of dto.permissions) {
      await this.enforcer.addPolicy(role, p.resource, p.action, p.effect);
    }

    // 3. Update inheritance
    await this.enforcer.removeFilteredGroupingPolicy(0, role);
    if (dto.inherits !== undefined) {
      for (const parent of dto.inherits) {
        await this.enforcer.addGroupingPolicy(role, parent);
      }
    } else {
      // Default behavior if not explicitly provided
      if (role !== 'admin' && role !== 'viewer') {
        await this.enforcer.addGroupingPolicy(role, 'viewer');
      }
    }

    return { role, ...(await this.getRoleDetails(role)) };
  }

  async deleteRole(role: string) {
    if (
      role === 'admin' ||
      role === 'viewer' ||
      role === 'webhook' ||
      role === 'agent'
    ) {
      throw new BadRequestException('Cannot delete system roles');
    }
    await this.enforcer.removeFilteredPolicy(0, role);
    await this.enforcer.removeFilteredGroupingPolicy(0, role);
    return { deleted: true };
  }
}
