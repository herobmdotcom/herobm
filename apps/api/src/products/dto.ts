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
  @IsEnum(['inventory', 'non-stock', 'service'])
  productType?: 'inventory' | 'non-stock' | 'service';

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
  name?: string;

  @IsOptional()
  @IsEnum(['inventory', 'non-stock', 'service'])
  productType?: 'inventory' | 'non-stock' | 'service';

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
