import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

export class UpdateManufacturingSettingsDto {
  @ApiPropertyOptional({
    description:
      'JSON Schema definition for user-defined metadata on Work Orders',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  workOrderMetadataSchema?: Record<string, unknown> | null;
}

export class ManufacturingSettingsResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  manufacturingSettingsId!: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  workOrderMetadataSchema?: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-03-31T08:00:00Z' })
  modifiedOn!: string;
}
