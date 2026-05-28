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

    // Casbin's subjects might include actual users (if they have direct policies, though we don't).
    // The policy usually has: p, role, resource, action. So the 'subject' in policy is our 'role'.
    const allRoles = new Set([...subjects, ...roles]);

    // Format response
    const result = [];
    for (const r of allRoles) {
      if (r === 'webhook' || r === 'agent') continue; // Skip internal system roles unless desired
      result.push({
        role: r,
        permissions: await this.getRolePermissions(r),
      });
    }

    return result;
  }

  async getRolePermissions(role: string): Promise<PermissionDto[]> {
    const policies = await this.enforcer.getFilteredPolicy(0, role);
    return policies.map((p) => ({
      resource: p[1],
      action: p[2],
    }));
  }

  async setRolePermissions(role: string, dto: SetRolePermissionsDto) {
    // 1. Remove all existing permissions for this role
    await this.enforcer.removeFilteredPolicy(0, role);

    // 2. Add new permissions
    for (const p of dto.permissions) {
      await this.enforcer.addPolicy(role, p.resource, p.action);
    }

    // 3. Make sure the role inherits from 'viewer' as a baseline (optional but standard in modbm)
    if (role !== 'admin' && role !== 'viewer') {
      const hasInheritance = await this.enforcer.hasGroupingPolicy(
        role,
        'viewer',
      );
      if (!hasInheritance) {
        await this.enforcer.addGroupingPolicy(role, 'viewer');
      }
    }

    return { role, permissions: await this.getRolePermissions(role) };
  }

  async deleteRole(role: string) {
    if (role === 'admin' || role === 'viewer') {
      throw new BadRequestException('Cannot delete system roles');
    }
    await this.enforcer.removeFilteredPolicy(0, role);
    await this.enforcer.removeFilteredGroupingPolicy(0, role);
    return { deleted: true };
  }
}
