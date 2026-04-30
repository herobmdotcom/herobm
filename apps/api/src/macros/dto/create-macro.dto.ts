import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateMacroDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  macroType?: string;

  @IsNotEmpty()
  @IsString()
  content: string;
}
