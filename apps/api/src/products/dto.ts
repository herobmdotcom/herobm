import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
  IsNotEmpty,
  IsEnum,
  IsNumberString,
  IsArray,
} from 'class-validator';

export class AddSupplierDto {
  @IsUUID('4')
  vendorId: string;

  @IsOptional()
  @IsString()
  supplierPartNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  productNumber!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(['inventory', 'non-stock', 'service', 'freight'])
  productType?: 'inventory' | 'non-stock' | 'service' | 'freight';

  @IsOptional()
  @IsEnum(['standard', 'kit'])
  structureType?: 'standard' | 'kit';

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumberString()
  listPrice?: string;

  @IsOptional()
  @IsNumberString()
  standardCost?: string;

  @IsOptional()
  @IsNumberString()
  tradePrice?: string;

  @IsOptional()
  @IsNumberString()
  priceLevel3?: string;

  @IsOptional()
  @IsNumberString()
  priceLevel4?: string;

  @IsOptional()
  @IsUUID()
  purchaseTaxCategoryId?: string;

  @IsOptional()
  @IsUUID()
  salesTaxCategoryId?: string;

  @IsOptional()
  @IsString()
  externalTaxCode?: string;

  @IsOptional()
  @IsString()
  alternateProductNumber?: string;

  @IsOptional()
  @IsUUID()
  productGroupId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  productNumber?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['inventory', 'non-stock', 'service', 'freight'])
  productType?: 'inventory' | 'non-stock' | 'service' | 'freight';

  @IsOptional()
  @IsEnum(['standard', 'kit'])
  structureType?: 'standard' | 'kit';

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumberString()
  listPrice?: string;

  @IsOptional()
  @IsNumberString()
  standardCost?: string;

  @IsOptional()
  @IsNumberString()
  tradePrice?: string;

  @IsOptional()
  @IsNumberString()
  priceLevel3?: string;

  @IsOptional()
  @IsNumberString()
  priceLevel4?: string;

  @IsOptional()
  @IsUUID()
  purchaseTaxCategoryId?: string;

  @IsOptional()
  @IsUUID()
  salesTaxCategoryId?: string;

  @IsOptional()
  @IsString()
  externalTaxCode?: string;

  @IsOptional()
  @IsString()
  alternateProductNumber?: string;

  @IsOptional()
  @IsUUID()
  productGroupId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsString()
  baseUom?: string;

  @IsOptional()
  @IsUUID()
  defaultSalesUomId?: string | null;

  @IsOptional()
  @IsUUID()
  defaultPurchaseUomId?: string | null;
}

export class CreateProductGroupDto {
  @IsString()
  @IsNotEmpty()
  groupCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUUID()
  defaultRevenueAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultExpenseAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultCostCenterId?: string;

  @IsOptional()
  @IsUUID()
  defaultActivityId?: string;
}

export class UpdateProductGroupDto {
  @IsOptional()
  @IsString()
  groupCode?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  defaultRevenueAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultExpenseAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultCostCenterId?: string;

  @IsOptional()
  @IsUUID()
  defaultActivityId?: string;
}

export class LinkBinDto {
  @IsUUID('4')
  @IsNotEmpty()
  locationId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  binId!: string;

  @IsOptional()
  isPrimaryPerLocation?: boolean;

  @IsOptional()
  @IsNumberString()
  minQuantity?: string;

  @IsOptional()
  @IsNumberString()
  maxQuantity?: string;
}

export class ProductResponseDto {
  id: string;
  productNumber: string;
  name: string;
  productType: string;
  structureType: string;
  barcode: string | null;
  listPrice: string;
  standardCost: string;
  tradePrice: string | null;
  priceLevel3: string | null;
  priceLevel4: string | null;
  purchaseTaxCategoryId: string | null;
  salesTaxCategoryId: string | null;
  externalTaxCode: string | null;
  alternateProductNumber: string | null;
  productGroupId: string | null;
  notes: string | null;
  stateCode: string | null;
  baseUom: string;
  defaultSalesUomId: string | null;
  defaultPurchaseUomId: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductGroupResponseDto {
  id: string;
  groupCode: string;
  name: string;
  defaultRevenueAccountId: string | null;
  defaultExpenseAccountId: string | null;
  defaultCostCenterId: string | null;
  defaultActivityId: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}
export class AddProductUomDto {
  @ApiProperty() uomCode!: string;
  @ApiProperty() ratio!: string;
  @ApiProperty({ required: false }) barcode?: string;
}
export class AddProductComponentDto {
  @ApiProperty() childProductId!: string;
  @ApiProperty() parentQuantity!: string;
  @ApiProperty() quantity!: string;
  @ApiProperty({ required: false }) sequenceNumber?: number;
  @ApiProperty({
    required: false,
    enum: ['allow_fractional', 'round_up', 'round_down', 'round_nearest'],
  })
  fractionalBehavior?:
    | 'allow_fractional'
    | 'round_up'
    | 'round_down'
    | 'round_nearest';
}
export class UpdateProductComponentDto {
  @ApiProperty({ required: false }) parentQuantity?: string;
  @ApiProperty({ required: false }) quantity?: string;
  @ApiProperty({ required: false }) sequenceNumber?: number;
  @ApiProperty({
    required: false,
    enum: ['allow_fractional', 'round_up', 'round_down', 'round_nearest'],
  })
  fractionalBehavior?:
    | 'allow_fractional'
    | 'round_up'
    | 'round_down'
    | 'round_nearest';
}

export class EmptyBodyDto {}
