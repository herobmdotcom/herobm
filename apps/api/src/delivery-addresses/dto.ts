import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  MaxLength,
  Length,
} from 'class-validator';

export class CreateDeliveryAddressDto {
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsOptional()
  addressName?: string;

  @IsString()
  @IsOptional()
  recipientName?: string;

  @IsString()
  @IsOptional()
  recipientPhone?: string;

  @IsString()
  @IsNotEmpty()
  addressLine1!: string;

  @IsString()
  @IsOptional()
  addressLine2?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  stateOrProvince?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  postalCode?: string | null;

  @IsString()
  @IsNotEmpty()
  @Length(2, 2, { message: 'Country must be a 2-letter ISO code' })
  country!: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class UpdateDeliveryAddressDto {
  @IsString()
  @IsOptional()
  addressName?: string;

  @IsString()
  @IsOptional()
  recipientName?: string;

  @IsString()
  @IsOptional()
  recipientPhone?: string;

  @IsString()
  @IsOptional()
  addressLine1?: string;

  @IsString()
  @IsOptional()
  addressLine2?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  stateOrProvince?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  postalCode?: string | null;

  @IsString()
  @IsOptional()
  @Length(2, 2, { message: 'Country must be a 2-letter ISO code' })
  country?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class DeliveryAddressResponseDto {
  id!: string;
  customerId!: string;
  addressName?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  addressLine1!: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateOrProvince?: string | null;
  postalCode?: string | null;
  country!: string | null;
  isPrimary!: boolean;
  sourceId?: string | null;
  source!: string;
  createdOn?: Date | null;
  modifiedOn?: Date | null;
}

export class DeleteDeliveryAddressSuccessDto {
  @ApiProperty()
  success!: boolean;
}
