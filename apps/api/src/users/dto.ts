import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
  IsEmail,
} from 'class-validator';

/** Valid portal roles — must match policy.csv exactly. */
const VALID_ROLES = [
  'admin',
  'viewer',
  'sales',
  'warehouse',
  'procurement',
  'finance',
] as const;

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      'Username may only contain letters, numbers, underscores, hyphens, and dots',
  })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72) // bcrypt silently truncates beyond 72 bytes
  password!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...VALID_ROLES])
  role!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password?: string;

  @IsOptional()
  @IsString()
  @IsIn([...VALID_ROLES])
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class UserResponseDto {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  displayName: string | null;
  email: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EmptyBodyDto {}
