import {
  IsString,
  IsArray,
  ValidateNested,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PermissionDto {
  @IsString()
  resource: string;

  @IsString()
  action: string;

  @IsString()
  @IsIn(['allow', 'deny'])
  effect: 'allow' | 'deny';
}

export class SetRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inherits?: string[];
}

export class AssignRoleDto {
  @IsString()
  role: string;
}

export class RoleDetailsDto {
  @IsString()
  role: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inherits?: string[];
}

export class SuccessResponseDto {
  @IsOptional()
  success?: boolean;
}
