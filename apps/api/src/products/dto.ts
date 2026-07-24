import { ApiProperty, PartialType } from '@nestjs/swagger';
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
import { Transform } from 'class-transformer';

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

export class BaseProductDto {
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
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  purchaseTaxCategoryId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
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
  @IsString()
  @IsNotEmpty()
  baseUom!: string;
}

export class CreateProductDto extends BaseProductDto {}

export class UpdateProductDto extends PartialType(BaseProductDto) {}

export class BaseProductGroupDto {
  @IsString()
  @IsNotEmpty()
  groupCode!: string;
  @IsString()
  @IsNotEmpty()
  name!: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultRevenueAccountId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultExpenseAccountId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultCostCenterId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultActivityId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  purchaseTaxCategoryId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  salesTaxCategoryId?: string;
}

export class CreateProductGroupDto extends BaseProductGroupDto {}

export class UpdateProductGroupDto extends PartialType(BaseProductGroupDto) {}

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
  productId: string;
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
  weight: string | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductGroupResponseDto {
  productGroupId: string;
  groupCode: string;
  name: string;
  defaultRevenueAccountId: string | null;
  defaultExpenseAccountId: string | null;
  defaultCostCenterId: string | null;
  defaultActivityId: string | null;
  purchaseTaxCategoryId: string | null;
  salesTaxCategoryId: string | null;
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
