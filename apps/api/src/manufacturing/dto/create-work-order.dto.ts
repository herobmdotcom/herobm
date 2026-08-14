import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkOrderComponentDto {
  @ApiProperty({ description: 'Product ID of the component item' })
  @IsNotEmpty()
  @IsUUID()
  productId!: string;

  @ApiProperty({
    description: 'Expected component quantity for this work order',
  })
  @IsNotEmpty()
  @IsString()
  expectedQuantity!: string;

  @ApiPropertyOptional({ description: 'Optional unit cost' })
  @IsOptional()
  @IsString()
  unitCost?: string;
}

export class CreateWorkOrderDto {
  @ApiPropertyOptional({
    description:
      'Optional custom order number (WO-YYYYMMDD-XXXX generated if empty)',
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiProperty({ description: 'Product ID of the output product to produce' })
  @IsNotEmpty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: 'Target quantity to produce' })
  @IsNotEmpty()
  @IsString()
  targetQuantity!: string;

  @ApiProperty({ description: 'Fulfillment location ID' })
  @IsNotEmpty()
  @IsUUID()
  locationId!: string;

  @ApiPropertyOptional({ description: 'WIP Bin ID (optional)' })
  @IsOptional()
  @IsUUID()
  wipBinId?: string;

  @ApiPropertyOptional({
    description: 'Finished Goods Output Bin ID (optional)',
  })
  @IsOptional()
  @IsUUID()
  outputBinId?: string;

  @ApiPropertyOptional({
    description: 'Per-unit assembly cost',
  })
  @IsOptional()
  @IsString()
  assemblyCostPerUnit?: string;

  @ApiPropertyOptional({
    description: 'Flat additional work order-level cost added to total',
  })
  @IsOptional()
  @IsString()
  additionalCost?: string;

  @ApiPropertyOptional({
    type: [CreateWorkOrderComponentDto],
    description:
      'Component lines snapshot (if empty, auto-populated from product BOM)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkOrderComponentDto)
  components?: CreateWorkOrderComponentDto[];
}
