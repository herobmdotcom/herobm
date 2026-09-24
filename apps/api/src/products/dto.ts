import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
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
  IsObject,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsPercentage } from '../common/validators/is-percentage.decorator';

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
  @IsNumber()
  @Min(0)
  @IsPercentage()
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPurchaseQty?: number;

  @IsOptional()
  @IsString()
  purchaseUnit?: string;

  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

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
  @IsString()
  imagePath?: string;
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
  @IsOptional()
  @IsNumberString()
  weight?: string;
  @IsOptional()
  @IsString()
  alternateInvoiceDescription?: string;
  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null ? null : String(value),
  )
  @IsNumberString()
  boxQuantity?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultSalesUomId?: string;
  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID()
  defaultPurchaseUomId?: string;
  @ApiPropertyOptional({ type: Object, description: 'Custom metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateProductDto extends BaseProductDto {}

export class UpdateProductDto extends PartialType(BaseProductDto) {}

export class CopyProductDto {
  @ApiPropertyOptional({
    description:
      'Optional new unique SKU. If omitted, will be auto-generated with -COPY suffix.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productNumber?: string;

  @ApiPropertyOptional({
    description:
      'Optional new product name. If omitted, defaults to source name with (Copy).',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

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
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.minQty;
    return raw === '' || raw === null || raw === undefined ? null : String(raw);
  })
  @IsNumberString()
  minQuantity?: string;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const raw = value !== undefined ? value : obj?.maxQty;
    return raw === '' || raw === null || raw === undefined ? null : String(raw);
  })
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
  imagePath: string | null;
  productGroupId: string | null;
  notes: string | null;
  stateCode: string | null;
  baseUom: string;
  defaultSalesUomId: string | null;
  defaultPurchaseUomId: string | null;
  weight: string | null;
  metadata?: Record<string, unknown> | null;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ProductSettingsResponseDto {
  @ApiPropertyOptional()
  settingsId?: string;

  @ApiPropertyOptional({ type: Object })
  productMetadataSchema?: Record<string, unknown> | null;
}

export class UpdateProductSettingsDto {
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  productMetadataSchema?: Record<string, unknown> | null;
}

export class ProductImageResponseDto {
  imageId: string;
  productId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  isPrimary: boolean;
  sortOrder: number;
  createdBy: string | null;
  createdOn: Date | null;
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

export class ProductCostSummaryResponseDto {
  @ApiProperty({ description: 'Product ID' })
  productId: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Standard cost per unit',
  })
  standardCost: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Weighted average cost per unit',
  })
  weightedAverageCost: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'List price per unit',
  })
  listPrice: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Trade price per unit',
  })
  tradePrice: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Preferred supplier unit cost price',
  })
  preferredSupplierCost: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Preferred supplier discount percentage',
  })
  preferredSupplierDiscount: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Preferred supplier vendor ID',
  })
  preferredSupplierVendorId: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Preferred supplier vendor name',
  })
  preferredSupplierName: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Preferred supplier vendor number',
  })
  preferredSupplierVendorNumber: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Unit price from latest purchase order line',
  })
  lastPurchasePrice: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Order date of latest purchase order',
  })
  lastPurchaseDate: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Order number of latest purchase order',
  })
  lastPurchaseOrderNumber: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Vendor name of latest purchase order',
  })
  lastPurchaseVendorName: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Purchase order ID of latest purchase order',
  })
  lastPurchaseOrderId: string | null;
}

export class AddProductUomDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  uomCode!: string;

  @ApiProperty()
  @IsNumberString()
  @IsNotEmpty()
  ratio!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  barcode?: string;
}

export class AddProductComponentDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  childProductId!: string;

  @ApiProperty()
  @IsNumberString()
  @IsNotEmpty()
  parentQuantity!: string;

  @ApiProperty()
  @IsNumberString()
  @IsNotEmpty()
  quantity!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  sequenceNumber?: number;

  @ApiProperty({
    required: false,
    enum: ['allow_fractional', 'round_up', 'round_down', 'round_nearest'],
  })
  @IsOptional()
  @IsEnum(['allow_fractional', 'round_up', 'round_down', 'round_nearest'])
  fractionalBehavior?:
    | 'allow_fractional'
    | 'round_up'
    | 'round_down'
    | 'round_nearest';
}

export class UpdateProductComponentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  parentQuantity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  quantity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  sequenceNumber?: number;

  @ApiProperty({
    required: false,
    enum: ['allow_fractional', 'round_up', 'round_down', 'round_nearest'],
  })
  @IsOptional()
  @IsEnum(['allow_fractional', 'round_up', 'round_down', 'round_nearest'])
  fractionalBehavior?:
    | 'allow_fractional'
    | 'round_up'
    | 'round_down'
    | 'round_nearest';
}

export class EmptyBodyDto {}

export class AddServiceMemberDto {
  @ApiProperty({
    description: 'Resource ID of the person to assign to the service product',
  })
  @IsUUID('4')
  @IsNotEmpty()
  resourceId!: string;
}

export class ServiceMemberResponseDto {
  @ApiProperty()
  memberId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  resourceId!: string;

  @ApiPropertyOptional()
  resourceNumber?: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  resourceType?: string;

  @ApiPropertyOptional()
  directUnitCost?: string;

  @ApiPropertyOptional()
  unitPrice?: string;

  @ApiPropertyOptional()
  baseUom?: string;

  @ApiPropertyOptional({ nullable: true })
  userId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  username?: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional()
  createdOn?: Date;
}
