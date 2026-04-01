import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  IsNumberString,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  vendorNumber!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  address1Line1?: string;

  @IsOptional()
  @IsString()
  address1Line2?: string;

  @IsOptional()
  @IsString()
  address1City?: string;

  @IsOptional()
  @IsString()
  address1StateOrProvince?: string;

  @IsOptional()
  @IsString()
  address1PostalCode?: string;

  @IsOptional()
  @IsString()
  address1Country?: string;

  @IsOptional()
  @IsString()
  telephone1?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @IsEmail()
  emailAddress1?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsUUID()
  supplierGroupId?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address1Line1?: string;

  @IsOptional()
  @IsString()
  address1Line2?: string;

  @IsOptional()
  @IsString()
  address1City?: string;

  @IsOptional()
  @IsString()
  address1StateOrProvince?: string;

  @IsOptional()
  @IsString()
  address1PostalCode?: string;

  @IsOptional()
  @IsString()
  address1Country?: string;

  @IsOptional()
  @IsString()
  telephone1?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @IsEmail()
  emailAddress1?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsUUID()
  supplierGroupId?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;
}

export class CreateSupplierGroupDto {
  @IsString()
  @IsNotEmpty()
  groupCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUUID()
  defaultApAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultExpenseAccountId?: string;
}

export class UpdateSupplierGroupDto {
  @IsOptional()
  @IsString()
  groupCode?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUUID()
  defaultApAccountId?: string;

  @IsOptional()
  @IsUUID()
  defaultExpenseAccountId?: string;
}
