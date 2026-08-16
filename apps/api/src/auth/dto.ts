import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

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
  access_token: string;
  username: string;
  displayName?: string | null;
  role: string;
}
export class MeResponseDto {
  username: string;
  displayName?: string | null;
  role: string;
  permissions?: { resource: string; action: string; effect: string }[];
}
