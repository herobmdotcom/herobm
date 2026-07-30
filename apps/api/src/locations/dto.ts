import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { binTypeEnum } from '@herobm/db-schema';
import { PartialType } from '@nestjs/swagger';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  stateOrProvince?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

export class CreateZoneDto {
  @IsUUID()
  locationId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class CreateBinDto {
  @IsUUID()
  zoneId!: string;

  @IsString()
  @IsNotEmpty()
  binNumber!: string;

  @IsNotEmpty()
  @IsIn(binTypeEnum.enumValues)
  binType!: (typeof binTypeEnum.enumValues)[number];

  @IsOptional()
  @IsBoolean()
  isConsignment?: boolean;

  @IsOptional()
  @IsBoolean()
  isBonded?: boolean;

  @IsOptional()
  @IsBoolean()
  isUnavailable?: boolean;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {}
export class UpdateZoneDto extends PartialType(CreateZoneDto) {}
export class UpdateBinDto extends PartialType(CreateBinDto) {}

export class LocationResponseDto {
  locationId!: string;
  code!: string;
  name!: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateOrProvince?: string;
  country?: string;
  postalCode?: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ZoneResponseDto {
  zoneId!: string;
  locationId!: string;
  code!: string;
  name!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class BinResponseDto {
  binId!: string;
  zoneId!: string;
  binNumber!: string;
  binType?: string;
  isConsignment?: boolean;
  isBonded?: boolean;
  isUnavailable?: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
