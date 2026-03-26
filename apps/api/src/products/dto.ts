import {
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsDateString,
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
