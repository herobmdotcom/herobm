import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class LoginResponseDto {
  access_token: string;
  username: string;
  role: string;
}
export class MeResponseDto {
  username: string;
  role: string;
}
