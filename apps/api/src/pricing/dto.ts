import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumberString,
} from 'class-validator';

export class CreateDiscountMatrixDto {
  @IsOptional()
  @IsUUID()
  customerGroupId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  productGroupId?: string;

  @IsNotEmpty()
  @IsNumberString()
  discountPercentage!: string;
}

export class UpdateDiscountMatrixDto {
  @IsOptional()
  @IsNumberString()
  discountPercentage?: string;
}
