import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateMacroDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  macroType!: string;

  @IsNotEmpty()
  @IsString()
  content: string;
}
