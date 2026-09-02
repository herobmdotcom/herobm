import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password!: string;
}

export class LoginResponseDto {
  access_token?: string;
  username: string;
  displayName?: string | null;
  role: string;
  twoFactorRequired?: boolean;
  tempToken?: string;
}
export class MeResponseDto {
  username: string;
  displayName?: string | null;
  role: string;
  permissions?: { resource: string; action: string; effect: string }[];
}

// ── Two-Factor Authentication DTOs ─────────────────────────────────

export class Verify2FaLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  tempToken!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  code!: string;
}

export class Enable2FaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  secret!: string;
}

export class Disable2FaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  code!: string;
}

export class RegenerateBackupCodesDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  code!: string;
}

export class TwoFactorSetupResponseDto {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

export class Enable2FaResponseDto {
  enabled: boolean;
  backupCodes: string[];
}

export class RegenerateBackupCodesResponseDto {
  backupCodes: string[];
}

export class TwoFactorStatusDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  verifiedAt?: string | null;
}

export class Disable2FaResponseDto {
  disabled: boolean;
}

export class Reset2FaResponseDto {
  reset: boolean;
}

export class EmptyBodyDto {}
