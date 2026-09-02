import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class UpdateUserSettingsDto {
  @ApiPropertyOptional({
    description: 'Dashboard configuration layout and pinned widgets',
  })
  @IsObject()
  @IsOptional()
  dashboardConfig?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Saved report configurations and filters',
  })
  @IsObject()
  @IsOptional()
  reportConfigs?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Generic UI preferences' })
  @IsObject()
  @IsOptional()
  preferences?: Record<string, unknown>;
}

export class UserSettingsResponseDto {
  @ApiPropertyOptional()
  dashboardConfig?: Record<string, unknown>;

  @ApiPropertyOptional()
  reportConfigs?: Record<string, unknown>;

  @ApiPropertyOptional()
  preferences?: Record<string, unknown>;
}
