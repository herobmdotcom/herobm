import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { binTypeEnum } from '../drizzle/modbm-core-schema';

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
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postCode?: string;
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

  @IsOptional()
  @IsIn(binTypeEnum.enumValues)
  binType?: typeof binTypeEnum.enumValues[number];

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
