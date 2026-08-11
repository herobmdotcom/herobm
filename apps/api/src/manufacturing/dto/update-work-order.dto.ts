import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

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
}

export class UpdateWorkOrderComponentDto {
  @ApiPropertyOptional({ description: 'Overridden unit cost' })
  @IsOptional()
  @IsString()
  unitCost?: string | null;
}
