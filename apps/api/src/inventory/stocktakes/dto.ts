import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
  IsIn,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { STOCKTAKE_STATE, type StocktakeState } from '@herobm/shared';

export class CreateStocktakeDto {
  @ApiProperty({ description: 'Descriptive title for this stocktake' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Location ID where stocktake takes place' })
  @IsUUID()
  @IsNotEmpty()
  locationId!: string;

  @ApiProperty({
    description: 'Scope of the stocktake',
    enum: ['full', 'zone', 'bin_pattern', 'manual'],
    default: 'full',
  })
  @IsString()
  @IsIn(['full', 'zone', 'bin_pattern', 'manual'])
  scopeType!: 'full' | 'zone' | 'bin_pattern' | 'manual';

  @ApiProperty({
    required: false,
    description: 'Zone code filter when scopeType is zone',
  })
  @IsOptional()
  @IsString()
  zoneFilter?: string;

  @ApiProperty({
    required: false,
    description: 'Bin pattern prefix when scopeType is bin_pattern',
  })
  @IsOptional()
  @IsString()
  binPattern?: string;

  @ApiProperty({
    required: false,
    description: 'Whether expected quantities are hidden from counters',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isBlindCount?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStocktakeDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isBlindCount?: boolean;
}

export class RecordStocktakeCountDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  binId!: string;

  @ApiProperty()
  @IsNumberString()
  @IsNotEmpty()
  quantity!: string;

  @ApiProperty({ required: false, enum: ['set', 'increment'], default: 'set' })
  @IsOptional()
  @IsIn(['set', 'increment'])
  countMode?: 'set' | 'increment';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BatchRecordStocktakeCountsDto {
  @ApiProperty({ type: () => [RecordStocktakeCountDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordStocktakeCountDto)
  counts!: RecordStocktakeCountDto[];
}

export class AddStocktakeUnlistedProductDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  binId!: string;

  @ApiProperty()
  @IsNumberString()
  @IsNotEmpty()
  countedQuantity!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateStocktakeLineDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  countedQuantity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class MarkStocktakeBinEmptyDto {
  @ApiProperty({
    required: false,
    description: 'Optional notes for marking bin empty',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class StocktakeStateTransitionDto {
  @ApiProperty({
    enum: Object.values(STOCKTAKE_STATE),
    description: 'Target lifecycle state',
  })
  @IsString()
  @IsIn(Object.values(STOCKTAKE_STATE))
  stateCode!: StocktakeState;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SubmitStocktakeDto {
  @ApiProperty({ description: 'Reconciliation reason and audit memo' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

// ── Response DTOs ──────────────────────────────────────────────────────────

export class StocktakeResponseDto {
  @ApiProperty()
  stocktakeId!: string;

  @ApiProperty()
  stocktakeNumber!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  locationId!: string;

  @ApiProperty()
  locationCode!: string;

  @ApiProperty()
  locationName!: string;

  @ApiProperty()
  stateCode!: string;

  @ApiProperty()
  scopeType!: string;

  @ApiProperty({ required: false, nullable: true })
  zoneFilter?: string | null;

  @ApiProperty({ required: false, nullable: true })
  binPattern?: string | null;

  @ApiProperty()
  isBlindCount!: boolean;

  @ApiProperty({ required: false, nullable: true })
  notes?: string | null;

  @ApiProperty({ required: false, nullable: true })
  inventoryEntryId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  createdBy?: string | null;

  @ApiProperty()
  createdOn!: Date;

  @ApiProperty({ required: false, nullable: true })
  openedBy?: string | null;

  @ApiProperty({ required: false, nullable: true })
  openedAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  reviewedBy?: string | null;

  @ApiProperty({ required: false, nullable: true })
  reviewedAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  submittedBy?: string | null;

  @ApiProperty({ required: false, nullable: true })
  submittedOn?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  cancelledBy?: string | null;

  @ApiProperty({ required: false, nullable: true })
  cancelledAt?: Date | null;

  @ApiProperty()
  totalLines!: number;

  @ApiProperty()
  countedLines!: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Number of lines with quantity discrepancies (null when blind count is active)',
  })
  discrepancyLines?: number | null;

  @ApiProperty()
  progressPercentage!: number;
}

export class StocktakeLineResponseDto {
  @ApiProperty()
  stocktakeLineId!: string;

  @ApiProperty()
  stocktakeId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty({ required: false, nullable: true })
  barcode?: string | null;

  @ApiProperty({ required: false, nullable: true })
  alternateProductNumber?: string | null;

  @ApiProperty()
  baseUom!: string;

  @ApiProperty()
  binId!: string;

  @ApiProperty()
  binNumber!: string;

  @ApiProperty({ required: false, nullable: true })
  zoneCode?: string | null;

  @ApiProperty({ required: false, nullable: true })
  expectedQuantity!: string | null; // masked in blind count when not permitted

  @ApiProperty({ required: false, nullable: true })
  countedQuantity!: string | null;

  @ApiProperty({ required: false, nullable: true })
  varianceQuantity?: string | null;

  @ApiProperty()
  status!: 'uncounted' | 'match' | 'surplus' | 'shortage';

  @ApiProperty()
  isUnlisted!: boolean;

  @ApiProperty({ required: false, nullable: true })
  notes?: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastCountedBy?: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastCountedAt?: Date | null;
}

export class StocktakeCountResponseDto {
  @ApiProperty()
  stocktakeCountId!: string;

  @ApiProperty()
  stocktakeId!: string;

  @ApiProperty({ required: false, nullable: true })
  stocktakeLineId?: string | null;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productNumber!: string;

  @ApiProperty()
  productName!: string;

  @ApiProperty()
  binId!: string;

  @ApiProperty()
  binNumber!: string;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  countMode!: string;

  @ApiProperty()
  countedBy!: string;

  @ApiProperty()
  countedAt!: Date;

  @ApiProperty({ required: false, nullable: true })
  notes?: string | null;
}

export class StocktakeSuccessResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ required: false })
  stocktakeId?: string;

  @ApiProperty({ required: false })
  stocktakeNumber?: string;

  @ApiProperty({ required: false })
  stateCode?: string;

  @ApiProperty({ required: false })
  reconciledCount?: number;

  @ApiProperty({ required: false })
  inventoryEntryId?: string;
}
