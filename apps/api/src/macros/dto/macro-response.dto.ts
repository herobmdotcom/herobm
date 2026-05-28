import { IsString, IsDate } from 'class-validator';

export class MacroResponseDto {
  @IsString()
  macroId: string;

  @IsString()
  name: string;

  @IsString()
  macroType: string;

  @IsString()
  content: string;

  @IsDate()
  createdOn: Date;

  @IsDate()
  modifiedOn: Date;
}
