import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PermissionDto {
  @IsString()
  resource: string;

  @IsString()
  action: string;
}

export class SetRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];
}

export class AssignRoleDto {
  @IsString()
  role: string;
}
