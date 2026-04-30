import { IsOptional, IsString } from 'class-validator';

export class UpdateMacroDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  macroType?: string;

  @IsOptional()
  @IsString()
  content?: string;
}
