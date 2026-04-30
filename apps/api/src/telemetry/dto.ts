import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class ClientErrorDto {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsOptional()
  @IsString()
  stack?: string;

  @IsOptional()
  @IsString()
  component?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;
}
