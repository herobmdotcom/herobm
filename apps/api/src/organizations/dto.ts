import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsUUID,
  IsArray,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty as SwaggerApiProperty } from '@nestjs/swagger';
import { PaginationQuery } from '../common/pagination';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  legalStatus?: string;

  @IsOptional()
  @IsString()
  headquartersAddressLine1?: string;
  @IsOptional()
  @IsString()
  headquartersAddressLine2?: string;
  @IsOptional()
  @IsString()
  headquartersCity?: string;
  @IsOptional()
  @IsString()
  headquartersStateOrProvince?: string;
  @IsOptional()
  @IsString()
  headquartersPostalCode?: string;
  @IsOptional()
  @IsString()
  headquartersCountry?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  businessNumber?: string;

  @IsOptional()
  @IsBoolean()
  isTaxRegistered?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  referralMode?: string;

  @IsOptional()
  @IsUUID()
  referredByOrganizationId?: string;

  @IsOptional()
  @IsUUID()
  referredByContactId?: string;

  @IsOptional()
  @IsString()
  referralNote?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  legalStatus?: string;

  @IsOptional()
  @IsString()
  headquartersAddressLine1?: string;
  @IsOptional()
  @IsString()
  headquartersAddressLine2?: string;
  @IsOptional()
  @IsString()
  headquartersCity?: string;
  @IsOptional()
  @IsString()
  headquartersStateOrProvince?: string;
  @IsOptional()
  @IsString()
  headquartersPostalCode?: string;
  @IsOptional()
  @IsString()
  headquartersCountry?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  businessNumber?: string;

  @IsOptional()
  @IsBoolean()
  isTaxRegistered?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  referralMode?: string;

  @IsOptional()
  @IsUUID()
  referredByOrganizationId?: string;

  @IsOptional()
  @IsUUID()
  referredByContactId?: string;

  @IsOptional()
  @IsString()
  referralNote?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsUUID()
  ownerId?: string | null;
}

export class CreateOrganizationNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class OrganizationNoteResponseDto {
  @IsUUID()
  noteId!: string;

  @IsString()
  content!: string;

  @IsString()
  createdOn!: Date;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  createdBy?: unknown;
}

export class OrganizationOwnerDto {
  @SwaggerApiProperty()
  userId!: string;

  @SwaggerApiProperty()
  username!: string;

  @SwaggerApiProperty({ required: false })
  displayName?: string | null;

  @SwaggerApiProperty({ required: false })
  email?: string | null;
}

export class OrganizationResponseDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  stateCode!: string;

  @IsString()
  name!: string;

  @SwaggerApiProperty({ required: false, type: String })
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @SwaggerApiProperty({ required: false, type: OrganizationOwnerDto })
  @IsOptional()
  owner?: OrganizationOwnerDto | null;

  @SwaggerApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  ownerDisplayName?: string | null;

  @IsOptional()
  @IsString()
  legalStatus?: string;

  @IsOptional()
  @IsString()
  headquartersAddressLine1?: string;
  headquartersAddressLine2?: string;
  headquartersCity?: string;
  headquartersStateOrProvince?: string;
  headquartersPostalCode?: string;
  headquartersCountry?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  businessNumber?: string;

  @IsBoolean()
  isTaxRegistered!: boolean;

  @IsString()
  createdOn!: Date;

  @IsString()
  modifiedOn!: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  notes?: OrganizationNoteResponseDto[];

  @IsOptional()
  organizationContactLinks?: unknown[];

  @IsOptional()
  events?: unknown[];

  @IsOptional()
  @IsString()
  referralMode?: string | null;

  @IsOptional()
  @IsUUID()
  referredByOrganizationId?: string | null;

  @IsOptional()
  @IsUUID()
  referredByContactId?: string | null;

  @IsOptional()
  @IsString()
  referredByOrganizationName?: string | null;

  @IsOptional()
  @IsString()
  referredByContactName?: string | null;

  @IsOptional()
  @IsString()
  referralNote?: string | null;

  @IsOptional()
  customers?: unknown[];

  @IsOptional()
  suppliers?: unknown[];
}

export class CreateOrganizationContactDto {
  @SwaggerApiProperty({ required: true, type: String })
  @IsUUID()
  contactId!: string;

  @SwaggerApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primaryFor?: string[];
}

export class UpdateOrganizationContactDto {
  @SwaggerApiProperty({ required: true, type: [String] })
  @IsArray()
  @IsString({ each: true })
  primaryFor!: string[];
}

export class CreateOrganizationLinkDto {
  @SwaggerApiProperty({ required: true, type: String })
  @IsUUID()
  targetOrganizationId!: string;

  @SwaggerApiProperty({
    enum: ['parent_company', 'subsidiary', 'partner', 'referrer'],
  })
  @IsIn(['parent_company', 'subsidiary', 'partner', 'referrer'])
  linkType!: 'parent_company' | 'subsidiary' | 'partner' | 'referrer';
}

export class OrganizationLinkPartnerDto {
  @SwaggerApiProperty()
  organizationId!: string;

  @SwaggerApiProperty()
  name!: string;

  @SwaggerApiProperty({ required: false })
  industry?: string | null;
}

export class OrganizationLinkResponseDto {
  @SwaggerApiProperty()
  linkId!: string;

  @SwaggerApiProperty()
  sourceOrganizationId!: string;

  @SwaggerApiProperty()
  targetOrganizationId!: string;

  @SwaggerApiProperty({
    enum: ['parent_company', 'subsidiary', 'partner', 'referrer'],
  })
  linkType!: string;

  @SwaggerApiProperty()
  createdOn!: Date;

  @SwaggerApiProperty({ required: false, type: OrganizationLinkPartnerDto })
  targetOrganization?: OrganizationLinkPartnerDto;

  @SwaggerApiProperty({ required: false, type: OrganizationLinkPartnerDto })
  sourceOrganization?: OrganizationLinkPartnerDto;
}

export class EmptyBodyDto {}

export { SuccessResponseDto } from '../common/dto/success-response.dto';

export class OrganizationQueryDto extends PaginationQuery {
  @SwaggerApiProperty({ required: false, type: String })
  @IsOptional()
  @IsString()
  ownerId?: string;
}

// Aliases for transition
export type CreateActorDto = CreateOrganizationDto;
export type UpdateActorDto = UpdateOrganizationDto;
export type ActorResponseDto = OrganizationResponseDto;
export type CreateActorContactDto = CreateOrganizationContactDto;
export type UpdateActorContactDto = UpdateOrganizationContactDto;
export type CreateActorNoteDto = CreateOrganizationNoteDto;
export type ActorNoteResponseDto = OrganizationNoteResponseDto;
export type CreateActorLinkDto = CreateOrganizationLinkDto;
export type ActorLinkResponseDto = OrganizationLinkResponseDto;
export type ActorQueryDto = OrganizationQueryDto;
