import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsObject } from 'class-validator';

export class UpdateWorkOrderDto {
  @ApiPropertyOptional({ description: 'Target quantity to produce' })
  @IsOptional()
  @IsString()
  targetQuantity?: string;

  @ApiPropertyOptional({ description: 'Fulfillment location ID' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'WIP Bin ID (optional)' })
  @IsOptional()
  @IsUUID()
  wipBinId?: string | null;

  @ApiPropertyOptional({
    description: 'Finished Goods Output Bin ID (optional)',
  })
  @IsOptional()
  @IsUUID()
  outputBinId?: string | null;

  @ApiPropertyOptional({ description: 'Per-unit assembly cost' })
  @IsOptional()
  @IsString()
  assemblyCostPerUnit?: string | null;

  @ApiPropertyOptional({
    description: 'Flat additional work order-level cost added to total',
  })
  @IsOptional()
  @IsString()
  additionalCost?: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'User-defined dynamic metadata attributes',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}

export class UpdateWorkOrderComponentDto {
  @ApiPropertyOptional({ description: 'Overridden unit cost' })
  @IsOptional()
  @IsString()
  unitCost?: string | null;
}
