import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class ClientErrorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  component?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;
}

export class EmptyBodyDto {}
